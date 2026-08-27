import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Prisma, VoucherStatus, PartnerApprovalStatus, UserRole, ActivityCategory } from '@prisma/client';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import { AuditService } from '../audit/audit.service';
import { VIETNAM_PROVINCES } from '../common/constants/vietnam-provinces';

/**
 * Service quản lý toàn bộ nghiệp vụ tạo, cập nhật, chuyển đổi trạng thái (vòng đời) chiến dịch Voucher.
 */
@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private mapCatalogPresentation<T extends {
    campaignBrands?: Array<{ isPrimary: boolean; brand: unknown }>;
    campaignCategories?: Array<{ isPrimary: boolean; category: unknown }>;
  }>(campaign: T) {
    const { campaignBrands = [], campaignCategories = [], ...base } = campaign;
    return {
      ...base,
      primaryBrand:
        campaignBrands.find((relation) => relation.isPrimary)?.brand ??
        campaignBrands[0]?.brand ??
        null,
      brands: campaignBrands.map((relation) => relation.brand),
      primaryCategory:
        campaignCategories.find((relation) => relation.isPrimary)?.category ??
        campaignCategories[0]?.category ??
        null,
      categories: campaignCategories.map((relation) => relation.category),
    };
  }

  private resolveActorPartnerId(actorUser: {
    userId: string;
    role: string;
    partnerId?: string | null;
  }): string | null {
    if (actorUser.role === UserRole.ADMIN) {
      return null;
    }

    if (actorUser.role === UserRole.PARTNER) {
      return actorUser.userId;
    }

    if (actorUser.role === UserRole.PARTNER_STAFF && actorUser.partnerId) {
      return actorUser.partnerId;
    }

    throw new ForbiddenException('Tài khoản không có phạm vi đối tác hợp lệ.');
  }

  /**
   * Tạo chiến dịch voucher mới ở trạng thái DRAFT.
   */
  async create(partnerId: string, createCampaignDto: CreateCampaignDto) {
    const {
      title,
      description,
      category,
      originalPrice,
      salePrice,
      saleStartTime,
      saleEndTime,
      usageStartTime,
      usageEndTime,
      capacity,
      isMultiUse,
      maxUsesPerCode,
      branchIds,
    } = createCampaignDto;

    // Bước 1: Xác thực đối tác đã được phê duyệt chưa (BR-PAR-01)
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });
    if (!partner || partner.approvalStatus !== PartnerApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tài khoản đối tác của bạn chưa được xét duyệt kích hoạt bởi Admin.');
    }

    // Bước 2: Thực thi các quy tắc ràng buộc nghiệp vụ (Business Rules)
    // RB-02: Giá bán khuyến mãi phải nhỏ hơn giá gốc
    if (salePrice >= originalPrice) {
      throw new BadRequestException('Giá khuyến mãi phải nhỏ hơn giá gốc của voucher (RB-02).');
    }

    // RB-03: Thời gian mở bán kết thúc phải lớn hơn thời gian mở bán bắt đầu
    const startSale = new Date(saleStartTime);
    const endSale = new Date(saleEndTime);
    if (endSale <= startSale) {
      throw new BadRequestException('Thời gian kết thúc bán phải sau thời gian bắt đầu bán (RB-03).');
    }

    const startUsage = new Date(usageStartTime);
    const endUsage = new Date(usageEndTime);
    if (endUsage <= startUsage) {
      throw new BadRequestException('Thời gian kết thúc sử dụng phải sau thời gian bắt đầu sử dụng.');
    }

    // Bước 3: Kiểm tra quyền sở hữu các chi nhánh được gán (RB-09)
    const ownedBranches = await this.prisma.branch.findMany({
      where: {
        partnerId,
        branchId: { in: branchIds },
      },
    });

    if (ownedBranches.length !== branchIds.length) {
      throw new BadRequestException('Một hoặc nhiều chi nhánh được lựa chọn không trực thuộc quyền sở hữu của bạn.');
    }

    // Bước 4: Lưu vào cơ sở dữ liệu thông qua transaction để gán các chi nhánh liên kết
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo chiến dịch voucher
      const campaign = await tx.voucherCampaign.create({
        data: {
          partnerId,
          title,
          description,
          category,
          originalPrice,
          salePrice,
          saleStartTime: startSale,
          saleEndTime: endSale,
          usageStartTime: startUsage,
          usageEndTime: endUsage,
          capacity,
          isMultiUse: isMultiUse ?? false,
          maxUsesPerCode,
          status: VoucherStatus.DRAFT, // Mặc định tạo mới ở dạng nháp
        },
      });

      // 2. Gán liên kết chi nhánh áp dụng vào bảng junction Campaign_Branches (RB-09)
      const campaignBranchesData = branchIds.map((branchId) => ({
        partnerId,
        campaignId: campaign.campaignId,
        branchId,
      }));

      await tx.campaignBranch.createMany({
        data: campaignBranchesData,
      });

      return tx.voucherCampaign.findUnique({
        where: { campaignId: campaign.campaignId },
        include: {
          campaignBranches: {
            include: { branch: true },
          },
        },
      });
    });
  }

  /**
   * Cập nhật thông tin chiến dịch voucher (chỉ cho phép khi ở trạng thái DRAFT hoặc REJECTED).
   */
  async update(partnerId: string, campaignId: string, updateCampaignDto: UpdateCampaignDto) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign || campaign.partnerId !== partnerId) {
      throw new NotFoundException('Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.');
    }

    // Chỉ cho phép chỉnh sửa khi chiến dịch ở trạng thái nháp DRAFT hoặc bị từ chối REJECTED
    if (campaign.status !== VoucherStatus.DRAFT && campaign.status !== VoucherStatus.REJECTED) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa chiến dịch voucher đang ở trạng thái Nháp hoặc Từ chối.');
    }

    const { branchIds, ...updateData } = updateCampaignDto;

    // Kiểm tra tính hợp lệ của giá nếu có cập nhật
    const originalPrice = updateData.originalPrice ?? Number(campaign.originalPrice);
    const salePrice = updateData.salePrice ?? Number(campaign.salePrice);
    if (salePrice >= originalPrice) {
      throw new BadRequestException('Giá khuyến mãi phải nhỏ hơn giá gốc của voucher (RB-02).');
    }

    // Kiểm tra tính hợp lệ của ngày nếu có cập nhật
    const startSale = updateData.saleStartTime ? new Date(updateData.saleStartTime) : campaign.saleStartTime;
    const endSale = updateData.saleEndTime ? new Date(updateData.saleEndTime) : campaign.saleEndTime;
    if (endSale <= startSale) {
      throw new BadRequestException('Thời gian kết thúc bán phải sau thời gian bắt đầu bán (RB-03).');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật các trường dữ liệu cơ bản
      await tx.voucherCampaign.update({
        where: { campaignId },
        data: {
          ...updateData,
          originalPrice,
          salePrice,
          saleStartTime: startSale,
          saleEndTime: endSale,
          usageStartTime: updateData.usageStartTime ? new Date(updateData.usageStartTime) : campaign.usageStartTime,
          usageEndTime: updateData.usageEndTime ? new Date(updateData.usageEndTime) : campaign.usageEndTime,
          status: VoucherStatus.DRAFT, // Trả lại trạng thái DRAFT sau khi sửa đổi
        },
      });

      // 2. Cập nhật danh sách chi nhánh liên kết nếu có truyền lên
      if (branchIds) {
        // Xác minh chi nhánh thuộc sở hữu
        const ownedBranches = await tx.branch.findMany({
          where: {
            partnerId,
            branchId: { in: branchIds },
          },
        });
        if (ownedBranches.length !== branchIds.length) {
          throw new BadRequestException('Một hoặc các chi nhánh được gán không trực thuộc quyền sở hữu của bạn.');
        }

        // Xóa liên kết cũ và thêm liên kết mới
        await tx.campaignBranch.deleteMany({
          where: { campaignId },
        });

        await tx.campaignBranch.createMany({
          data: branchIds.map((branchId) => ({
            partnerId,
            campaignId,
            branchId,
          })),
        });
      }

      return tx.voucherCampaign.findUnique({
        where: { campaignId },
        include: {
          campaignBranches: {
            include: { branch: true },
          },
        },
      });
    });
  }

  /**
   * Gửi duyệt chiến dịch voucher (chuyển trạng thái từ DRAFT/REJECTED thành PENDING_APPROVAL).
   */
  async submitForApproval(partnerId: string, campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign || campaign.partnerId !== partnerId) {
      throw new NotFoundException('Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.');
    }

    if (campaign.status !== VoucherStatus.DRAFT && campaign.status !== VoucherStatus.REJECTED) {
      throw new BadRequestException('Chỉ có thể gửi duyệt chiến dịch voucher đang ở trạng thái Nháp hoặc Bị từ chối.');
    }

    return this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.PENDING_APPROVAL },
    });
  }

  /**
   * Lấy danh sách toàn bộ chiến dịch voucher của một đối tác cụ thể.
   */
  async getPartnerCampaigns(partnerId: string) {
    const campaigns = await this.prisma.voucherCampaign.findMany({
      where: { partnerId },
      include: {
        campaignBranches: {
          include: { branch: true },
        },
        campaignCategories: {
          include: {
            category: {
              select: {
                nameVi: true,
                code: true,
              },
            },
          },
        },
        orderItems: {
          select: {
            quantity: true,
            unitPrice: true,
            voucherCodes: {
              where: {
                status: 'USED',
              },
              select: {
                codeId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => {
      const usedCount = campaign.orderItems.reduce(
        (sum, item) => sum + item.voucherCodes.length,
        0,
      );

      const revenue = campaign.orderItems.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );

      const { orderItems, ...base } = campaign;
      return {
        ...base,
        usedCount,
        revenue,
      };
    });
  }

  /**
   * Chi tiết chiến dịch voucher.
   */
  async findOne(campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
      include: {
        partner: {
          select: { companyName: true, representative: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
        campaignBrands: {
          include: { brand: true },
          orderBy: { isPrimary: 'desc' },
        },
        campaignCategories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
    }

    return this.mapCatalogPresentation(campaign);
  }

  /**
   * Danh mục cấp cao nhất dùng cho bộ lọc catalog. Count chỉ gồm voucher còn hàng,
   * đã được duyệt và đang trong thời gian mở bán.
   */
  async findPublicCategories() {
    const now = new Date();
    const activeCampaignWhere: Prisma.CampaignCategoryWhereInput = {
      campaign: {
        status: VoucherStatus.APPROVED,
        saleStartTime: { lte: now },
        saleEndTime: { gte: now },
      },
    };
    const categories = await this.prisma.voucherCategory.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
      include: {
        campaignCategories: {
          where: activeCampaignWhere,
          select: {
            campaignId: true,
            campaign: { select: { capacity: true, soldQuantity: true } },
          },
        },
        children: {
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
          include: {
            campaignCategories: {
              where: activeCampaignWhere,
              select: {
                campaignId: true,
                campaign: { select: { capacity: true, soldQuantity: true } },
              },
            },
          },
        },
      },
    });

    const allCampaignIds = new Set<string>();
    const categoryItems = categories.map((category) => {
      const direct = category.campaignCategories.filter(
        (relation) => relation.campaign.soldQuantity < relation.campaign.capacity,
      );
      const children = category.children.map((child) => ({
        code: child.code,
        name: child.nameVi,
        campaignCount: child.campaignCategories.filter(
          (relation) => relation.campaign.soldQuantity < relation.campaign.capacity,
        ).length,
      }));
      const campaignIds = new Set([
        ...direct.map((relation) => relation.campaignId),
        ...category.children.flatMap((child) =>
          child.campaignCategories
            .filter(
              (relation) => relation.campaign.soldQuantity < relation.campaign.capacity,
            )
            .map((relation) => relation.campaignId),
        ),
      ]);
      campaignIds.forEach((campaignId) => allCampaignIds.add(campaignId));

      return {
        code: category.code,
        name: category.nameVi,
        campaignCount: campaignIds.size,
        children,
      };
    });

    return {
      totalCampaignCount: allCampaignIds.size,
      categories: categoryItems,
    };
  }

  /**
   * Khách hàng: Lấy danh sách đối tác đang có voucher khả dụng để làm bộ lọc.
   */
  async findPublicPartners() {
    const now = new Date();
    const partners = await this.prisma.partner.findMany({
      where: {
        user: {
          status: 'ACTIVE'
        },
        campaigns: {
          some: {
            status: VoucherStatus.APPROVED,
            saleStartTime: { lte: now },
            saleEndTime: { gte: now },
          },
        },
      },
      select: {
        partnerId: true,
        companyName: true,
      },
      orderBy: { companyName: 'asc' },
    });
    return partners;
  }

  /**
   * Khách hàng: Lấy danh sách tỉnh/thành phố có voucher đang mở bán.
   */
  async findPublicProvinces() {
    const now = new Date();
    const relations = await this.prisma.campaignBranch.findMany({
      where: {
        branch: { provinceCode: { not: null } },
        campaign: {
          status: VoucherStatus.APPROVED,
          saleStartTime: { lte: now },
          saleEndTime: { gte: now },
        },
      },
      select: {
        campaignId: true,
        branch: { select: { provinceCode: true } },
        campaign: { select: { capacity: true, soldQuantity: true } },
      },
    });

    const campaignIdsByProvince = new Map<string, Set<string>>();
    for (const relation of relations) {
      const provinceCode = relation.branch.provinceCode;
      if (!provinceCode || relation.campaign.soldQuantity >= relation.campaign.capacity) {
        continue;
      }
      const campaignIds = campaignIdsByProvince.get(provinceCode) ?? new Set<string>();
      campaignIds.add(relation.campaignId);
      campaignIdsByProvince.set(provinceCode, campaignIds);
    }

    return VIETNAM_PROVINCES.flatMap((province) => {
      const campaignCount = campaignIdsByProvince.get(province.code)?.size ?? 0;
      return campaignCount > 0 ? [{ ...province, campaignCount }] : [];
    });
  }

  /**
   * Lấy danh sách voucher công khai để hiển thị trên trang chủ cho khách hàng.
   * Hỗ trợ tìm kiếm từ khóa, danh mục, khoảng giá và chi nhánh áp dụng.
   */
  async findPublicCatalog(query: PublicCatalogQueryDto) {
    const {
      keyword,
      category,
      categoryCode,
      minPrice,
      maxPrice,
      branchId,
      provinceCode,
      sortPrice,
      sortDiscount,
      partnerId,
      validityStatus,
      minDiscount,
      page = 1,
      limit = 20,
    } = query;
    const now = new Date();

    // Ràng buộc cơ bản: Chiến dịch phải được phê duyệt
    const whereClause: Prisma.VoucherCampaignWhereInput = {
      status: VoucherStatus.APPROVED,
    };

    if (validityStatus === 'AVAILABLE') {
      whereClause.saleStartTime = { lte: now };
      whereClause.saleEndTime = { gte: now };
    } else if (validityStatus === 'UPCOMING') {
      whereClause.saleStartTime = { gt: now };
    } else {
      // Mặc định trả về cả AVAILABLE và UPCOMING nếu không có tuỳ chọn
      whereClause.saleEndTime = { gte: now };
    }

    if (partnerId) {
      whereClause.partnerId = partnerId;
    }

    if (categoryCode) {
      whereClause.campaignCategories = {
        some: {
          category: {
            OR: [
              { code: categoryCode },
              { parent: { is: { code: categoryCode } } },
            ],
          },
        },
      };
    } else if (category) {
      whereClause.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      whereClause.salePrice = {};
      if (minPrice !== undefined) {
        whereClause.salePrice.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        whereClause.salePrice.lte = maxPrice;
      }
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      const mappedCategories: string[] = [];

      // Keyword to Category Mapping (Semantic search approximation)
      if (['đồ ăn', 'ăn uống', 'ẩm thực', 'nhà hàng', 'quán ăn', 'cafe', 'trà sữa', 'buffet', 'lẩu', 'nướng'].some(w => lowerKeyword.includes(w))) {
        mappedCategories.push('Food & Beverage', 'FOOD_DRINK');
      }
      if (['spa', 'làm đẹp', 'cắt tóc', 'massage', 'skincare', 'nail', 'gội đầu'].some(w => lowerKeyword.includes(w))) {
        mappedCategories.push('Beauty & Spa');
      }
      if (['mua sắm', 'quần áo', 'giày dép', 'thời trang', 'siêu thị', 'thực phẩm'].some(w => lowerKeyword.includes(w))) {
        mappedCategories.push('Shopping');
      }
      if (['giải trí', 'xem phim', 'vui chơi', 'du lịch', 'khách sạn', 'vé'].some(w => lowerKeyword.includes(w))) {
        mappedCategories.push('Entertainment');
      }

      const searchConditions: any[] = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { termsAndConditions: { contains: keyword, mode: 'insensitive' } },
        {
          campaignBrands: {
            some: {
              brand: { displayName: { contains: keyword, mode: 'insensitive' } },
            },
          },
        },
      ];

      if (mappedCategories.length > 0) {
        searchConditions.push({ category: { in: mappedCategories } });
      }

      whereClause.OR = searchConditions;
    }

    if (branchId || provinceCode) {
      whereClause.campaignBranches = {
        some: {
          ...(branchId ? { branchId } : {}),
          ...(provinceCode
            ? { branch: { is: { provinceCode } } }
            : {}),
        },
      };
    }

    const orderByClause: any[] = [];
    if (sortPrice) {
      orderByClause.push({ salePrice: sortPrice });
    }
    // Prisma không hỗ trợ sort theo percentage (original - sale)/original.
    // Sẽ sort bằng JS sau khi query nếu cần.
    orderByClause.push({ createdAt: 'desc' });

    const campaigns = await this.prisma.voucherCampaign.findMany({
      where: whereClause,
      include: {
        partner: {
          select: { companyName: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
        campaignBrands: {
          include: { brand: true },
          orderBy: { isPrimary: 'desc' },
        },
        campaignCategories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
      orderBy: orderByClause,
    });

    let processedCampaigns = campaigns
      .filter((campaign) => campaign.soldQuantity < campaign.capacity)
      .map((campaign) => this.mapCatalogPresentation(campaign));

    // Lọc theo discount (nếu có minDiscount)
    if (minDiscount !== undefined) {
      processedCampaigns = processedCampaigns.filter((c) => {
        const discountPct = ((Number(c.originalPrice) - Number(c.salePrice)) / Number(c.originalPrice)) * 100;
        return discountPct >= minDiscount;
      });
    }

    // Sort by discount
    if (sortDiscount) {
      processedCampaigns.sort((a, b) => {
        const aDisc = ((Number(a.originalPrice) - Number(a.salePrice)) / Number(a.originalPrice)) * 100;
        const bDisc = ((Number(b.originalPrice) - Number(b.salePrice)) / Number(b.originalPrice)) * 100;
        return sortDiscount === 'desc' ? bDisc - aDisc : aDisc - bDisc;
      });
    }

    // Pagination
    const total = processedCampaigns.length;
    const startIndex = (page - 1) * limit;
    const paginatedCampaigns = processedCampaigns.slice(startIndex, startIndex + limit);

    return {
      data: paginatedCampaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ================= ADMIN OPERATIONS =================

  /**
   * Admin: Xem danh sách các voucher đang chờ phê duyệt.
   */
  async adminListPendingCampaigns() {
    return this.prisma.voucherCampaign.findMany({
      where: { status: VoucherStatus.PENDING_APPROVAL },
      include: {
        partner: {
          select: { companyName: true, representative: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Admin: Phê duyệt voucher chiến dịch thành APPROVED.
   */
  async adminApproveCampaign(adminId: string, campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Chiến dịch voucher cần duyệt không tồn tại.');
    }

    if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Chỉ có thể phê duyệt chiến dịch voucher đang ở trạng thái Chờ phê duyệt.');
    }

    const updated = await this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.APPROVED },
    });

    await this.auditService.logAction(adminId, 'APPROVE_VOUCHER', 'VoucherCampaign', campaignId);
    return updated;
  }

  /**
   * Admin: Từ chối phê duyệt voucher chiến dịch thành REJECTED.
   */
  async adminRejectCampaign(adminId: string, campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Chiến dịch voucher cần từ chối không tồn tại.');
    }

    if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Chỉ có thể từ chối chiến dịch voucher đang ở trạng thái Chờ phê duyệt.');
    }

    const updated = await this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.REJECTED },
    });

    await this.auditService.logAction(adminId, 'REJECT_VOUCHER', 'VoucherCampaign', campaignId);
    return updated;
  }

  /**
   * Lấy danh sách ví voucher cá nhân của một khách hàng (Customer Wallet).
   * @param customerId ID khách hàng sở hữu các mã voucher
   */
  async getCustomerWallet(customerId: string) {
    return this.prisma.voucherCode.findMany({
      where: {
        customerId,
        OR: [
          {
            orderItem: {
              order: {
                isGift: false,
              },
            },
          },
          {
            orderItem: {
              order: {
                isGift: true,
                customerId: { not: customerId },
              },
            },
          },
        ],
      },
      include: {
        orderItem: {
          include: {
            campaign: {
              include: {
                partner: {
                  select: { companyName: true },
                },
                campaignBranches: {
                  include: { branch: true },
                },
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Xem trước thông tin mã voucher trước khi nhân viên xác nhận quét đổi (Preview Verification).
   * @param actorUser Đối tác/Nhân viên quét
   * @param uniqueCode Mã voucher cần kiểm tra
   */
  async verifyVoucherCode(
    actorUser: { userId: string; role: string; partnerId?: string | null; branchId?: string | null },
    uniqueCode: string,
  ) {
    const voucher = await this.prisma.voucherCode.findUnique({
      where: { uniqueCode },
      include: {
        customer: {
          select: { fullName: true, email: true },
        },
        orderItem: {
          include: {
            campaign: {
              include: {
                partner: { select: { companyName: true, partnerId: true } },
                campaignBranches: { include: { branch: true } },
              },
            },
          },
        },
        usageLogs: {
          include: { branch: true },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException('Mã voucher này không tồn tại trên hệ thống.');
    }

    const campaign = voucher.orderItem.campaign;
    const actorPartnerId = this.resolveActorPartnerId(actorUser);

    if (actorPartnerId && campaign.partnerId !== actorPartnerId) {
      throw new ForbiddenException('Mã voucher này thuộc về đối tác khác.');
    }

    if (
      actorUser.role === UserRole.PARTNER_STAFF &&
      actorUser.branchId &&
      !campaign.campaignBranches.some((item) => item.branchId === actorUser.branchId)
    ) {
      throw new ForbiddenException('Voucher không áp dụng tại chi nhánh được phân công.');
    }

    // Trả về trạng thái chi tiết của voucher để hiển thị
    const now = new Date();
    let computedStatus = voucher.status;

    if (
      voucher.status === 'AVAILABLE' &&
      ((voucher.expiresAt && now > voucher.expiresAt) ||
        now > campaign.usageEndTime)
    ) {
      computedStatus = 'EXPIRED';
    }

    return {
      codeId: voucher.codeId,
      uniqueCode: voucher.uniqueCode,
      status: computedStatus,
      issuedAt: voucher.issuedAt,
      expiresAt: voucher.expiresAt,
      customer: voucher.customer,
      campaign: {
        title: campaign.title,
        description: campaign.description,
        usageStartTime: campaign.usageStartTime,
        usageEndTime: campaign.usageEndTime,
        partner: campaign.partner,
        isMultiUse: campaign.isMultiUse,
        maxUsesPerCode: campaign.maxUsesPerCode,
        branches: campaign.campaignBranches.map((cb) => cb.branch.name),
      },
      usageLogs: voucher.usageLogs.map((log) => ({
        usedAt: log.usedAt,
        branchName: log.branch.name,
      })),
    };
  }

  /**
   * Thực hiện quét và đổi mã voucher tại chi nhánh (Redemption logic).
   * Có row-level locking (SELECT FOR UPDATE) để chống race-condition quét trùng lặp.
   * @param actorUser Thông tin đối tác/nhân viên thực hiện quét
   * @param uniqueCode Chuỗi mã voucher cần quét
   * @param branchId ID chi nhánh thực hiện quét
   */
  async redeemVoucher(
    actorUser: { userId: string; role: string; partnerId?: string | null; branchId?: string | null },
    uniqueCode: string,
    branchId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tìm VoucherCode theo uniqueCode và khóa dòng để chống double-redemption
      const rawCode = await tx.voucherCode.findUnique({
        where: { uniqueCode },
      });

      if (!rawCode) {
        throw new NotFoundException('Mã voucher này không tồn tại trên hệ thống.');
      }

      await tx.$executeRawUnsafe(
        `SELECT code_id FROM "Voucher_Codes" WHERE code_id = $1::uuid FOR UPDATE`,
        rawCode.codeId,
      );

      // Nạp đầy đủ thông tin liên kết
      const voucher = await tx.voucherCode.findUnique({
        where: { codeId: rawCode.codeId },
        include: {
          orderItem: {
            include: {
              campaign: {
                include: {
                  campaignBranches: true,
                },
              },
            },
          },
          usageLogs: true,
        },
      });

      if (!voucher) {
        throw new NotFoundException('Mã voucher không còn khả dụng.');
      }

      const campaign = voucher.orderItem.campaign;
      const actorPartnerId = this.resolveActorPartnerId(actorUser);

      if (actorPartnerId && campaign.partnerId !== actorPartnerId) {
        throw new ForbiddenException('Mã voucher này thuộc về đối tác khác.');
      }

      if (
        actorUser.role === UserRole.PARTNER_STAFF &&
        actorUser.branchId &&
        actorUser.branchId !== branchId
      ) {
        throw new ForbiddenException('Bạn không được phép quét tại chi nhánh khác.');
      }

      // 3. Kiểm tra chi nhánh áp dụng của chiến dịch voucher (RB-09)
      const isBranchApplicable = campaign.campaignBranches.some((cb) => cb.branchId === branchId);
      if (!isBranchApplicable) {
        throw new BadRequestException('Chiến dịch voucher này không được áp dụng tại chi nhánh hiện tại.');
      }

      // 4. Kiểm tra trạng thái khả dụng của mã (RB-07)
      if (voucher.status === 'USED') {
        throw new BadRequestException('Mã voucher này đã được sử dụng.');
      }
      if (voucher.status === 'EXPIRED') {
        throw new BadRequestException('Mã voucher này đã hết hạn.');
      }
      if (voucher.status === 'CANCELLED') {
        throw new BadRequestException('Mã voucher này đã bị hủy.');
      }
      if (voucher.status === 'LOCKED') {
        throw new BadRequestException('Mã voucher này hiện đang bị khóa.');
      }
      if (voucher.status !== 'AVAILABLE') {
        throw new BadRequestException('Mã voucher này không ở trạng thái khả dụng.');
      }

      // 5. Kiểm tra thời hạn sử dụng cá nhân và thời gian chiến dịch (RB-08)
      const now = new Date();
      if (voucher.expiresAt && now > voucher.expiresAt) {
        await tx.voucherCode.update({
          where: { codeId: voucher.codeId },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Mã voucher cá nhân đã hết hạn sử dụng.');
      }

      if (now < campaign.usageStartTime) {
        throw new BadRequestException('Voucher chưa đến thời gian áp dụng.');
      }
      if (now > campaign.usageEndTime) {
        await tx.voucherCode.update({
          where: { codeId: voucher.codeId },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Voucher đã hết hạn sử dụng theo chiến dịch.');
      }

      // 6. Ghi nhận lịch sử sử dụng VoucherUsageLog
      const log = await tx.voucherUsageLog.create({
        data: {
          codeId: voucher.codeId,
          branchId,
          usedAt: now,
        },
        include: {
          branch: true,
        },
      });

      // 7. Xử lý trạng thái mã voucher (Single-use vs Multi-use)
      const totalUses = voucher.usageLogs.length + 1; // Tính cả lượt quét hiện tại
      if (campaign.isMultiUse) {
        const maxUses = campaign.maxUsesPerCode || 1;
        if (totalUses >= maxUses) {
          // Đạt giới hạn quét tối đa -> chuyển sang USED
          await tx.voucherCode.update({
            where: { codeId: voucher.codeId },
            data: { status: 'USED' },
          });
        }
      } else {
        // Single-use -> Chuyển sang USED ngay sau lần quét đầu tiên
        await tx.voucherCode.update({
          where: { codeId: voucher.codeId },
          data: { status: 'USED' },
        });
      }

      return log;
    });

    await this.auditService.logActivity({
      actorUserId: actorUser.userId,
      actorRoleSnapshot: actorUser.role as UserRole,
      category: ActivityCategory.VOUCHER,
      actionType: 'REDEEM_VOUCHER',
      targetEntity: 'VoucherCode',
      targetId: uniqueCode,
      metadata: { branchId },
    });

    return result;
  }

  async adminListCategories() {
    const categories = await this.prisma.voucherCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
      include: {
        _count: {
          select: { campaignCategories: true },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      campaignCount: cat._count.campaignCategories,
    }));
  }

  /**
   * Admin: Tạo danh mục voucher mới (BR-ADM-05).
   */
  async adminCreateCategory(adminId: string, data: { code: string; nameVi: string; parentId?: string; displayOrder?: number }) {
    const existing = await this.prisma.voucherCategory.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException('Mã danh mục này đã tồn tại trong hệ thống.');
    }

    const created = await this.prisma.voucherCategory.create({
      data: {
        code: data.code,
        nameVi: data.nameVi,
        parentId: data.parentId || null,
        displayOrder: data.displayOrder ?? 0,
        isActive: true,
      },
    });

    if (adminId) {
      await this.auditService.logAction(adminId, 'CREATE_CATEGORY', 'VoucherCategory', created.categoryId);
    }
    return created;
  }

  /**
   * Admin: Cập nhật danh mục voucher (BR-ADM-05).
   */
  async adminUpdateCategory(adminId: string, categoryId: string, data: { nameVi?: string; parentId?: string; displayOrder?: number; isActive?: boolean }) {
    const category = await this.prisma.voucherCategory.findUnique({
      where: { categoryId },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục yêu cầu.');
    }

    const updated = await this.prisma.voucherCategory.update({
      where: { categoryId },
      data: {
        nameVi: data.nameVi,
        parentId: data.parentId !== undefined ? (data.parentId || null) : undefined,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      },
    });

    if (adminId) {
      await this.auditService.logAction(adminId, 'UPDATE_CATEGORY', 'VoucherCategory', categoryId);
    }
    return updated;
  }

  /**
   * Admin: Xóa danh mục voucher (BR-ADM-05).
   */
  async adminDeleteCategory(adminId: string, categoryId: string) {
    const campaignCount = await this.prisma.campaignCategory.count({
      where: { categoryId },
    });
    if (campaignCount > 0) {
      throw new BadRequestException('Không thể xóa danh mục này vì đang có chiến dịch voucher liên kết.');
    }

    const childrenCount = await this.prisma.voucherCategory.count({
      where: { parentId: categoryId },
    });
    if (childrenCount > 0) {
      throw new BadRequestException('Không thể xóa danh mục này vì có danh mục con đang trực thuộc.');
    }

    const deleted = await this.prisma.voucherCategory.delete({
      where: { categoryId },
    });

    if (adminId) {
      await this.auditService.logAction(adminId, 'DELETE_CATEGORY', 'VoucherCategory', categoryId);
    }
    return deleted;
  }

  /**
   * Admin: Lấy danh sách toàn bộ chiến dịch voucher (BR-ADM-03).
   * @param query Bộ lọc từ khóa và trạng thái
   */
  async adminListCampaigns(query: { keyword?: string; status?: string }) {
    const where: Prisma.VoucherCampaignWhereInput = {};
    if (query.status) {
      where.status = query.status as VoucherStatus;
    }
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { description: { contains: query.keyword, mode: 'insensitive' } },
        { partner: { companyName: { contains: query.keyword, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.voucherCampaign.findMany({
      where,
      include: {
        partner: {
          select: {
            companyName: true,
            representative: true,
          },
        },
        campaignBranches: {
          include: {
            branch: true,
          },
        },
        // Bao gồm danh mục tiếng Việt từ bảng quan hệ CampaignCategory
        campaignCategories: {
          include: {
            category: {
              select: {
                nameVi: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Cập nhật trạng thái vòng đời của một chiến dịch voucher (BR-ADM-03).
   */
  async adminUpdateCampaignStatus(adminId: string, campaignId: string, status: VoucherStatus) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
    }

    const updated = await this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status },
    });

    await this.auditService.logAction(adminId, 'UPDATE_CAMPAIGN_STATUS', 'VoucherCampaign', campaignId);
    return updated;
  }

  /**
   * Admin/Partner: Khóa mã voucher cá nhân (VoucherCode) ngưng không cho phép quét sử dụng (LOCKED).
   * @param actorId ID người thao tác (Admin hoặc Partner)
   * @param codeId ID mã voucher cần khóa
   */
  async lockVoucherCode(actorId: string, codeId: string) {
    const voucher = await this.prisma.voucherCode.findUnique({
      where: { codeId },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy mã voucher yêu cầu.');
    }

    if (voucher.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `Không thể khóa mã voucher đang ở trạng thái ${voucher.status}.`,
      );
    }

    const updated = await this.prisma.voucherCode.update({
      where: { codeId },
      data: { status: 'LOCKED' },
    });

    await this.auditService.logAction(
      actorId,
      'LOCK_VOUCHER_CODE',
      'VoucherCode',
      codeId,
    );
    return updated;
  }

  /**
   * Admin/Partner: Mở khóa mã voucher bị khóa trước đó về trạng thái khả dụng (AVAILABLE).
   * @param actorId ID người thao tác (Admin hoặc Partner)
   * @param codeId ID mã voucher cần mở khóa
   */
  async unlockVoucherCode(actorId: string, codeId: string) {
    const voucher = await this.prisma.voucherCode.findUnique({
      where: { codeId },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy mã voucher yêu cầu.');
    }

    if (voucher.status !== 'LOCKED') {
      throw new BadRequestException(
        'Chỉ có thể mở khóa đối với các mã voucher đang bị khóa (LOCKED).',
      );
    }

    const updated = await this.prisma.voucherCode.update({
      where: { codeId },
      data: { status: 'AVAILABLE' },
    });

    await this.auditService.logAction(
      actorId,
      'UNLOCK_VOUCHER_CODE',
      'VoucherCode',
      codeId,
    );
    return updated;
  }
}

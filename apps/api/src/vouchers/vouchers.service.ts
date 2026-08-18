import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Prisma, VoucherStatus, PartnerApprovalStatus, UserRole } from '@prisma/client';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import { AuditService } from '../audit/audit.service';

/**
 * Service quản lý toàn bộ nghiệp vụ tạo, cập nhật, chuyển đổi trạng thái (vòng đời) chiến dịch Voucher.
 */
@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

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
    return this.prisma.voucherCampaign.findMany({
      where: { partnerId },
      include: {
        campaignBranches: {
          include: { branch: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
          select: { companyName: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
    }

    return campaign;
  }

  /**
   * Lấy danh sách voucher công khai để hiển thị trên trang chủ cho khách hàng.
   * Hỗ trợ tìm kiếm từ khóa, danh mục, khoảng giá và chi nhánh áp dụng.
   */
  async findPublicCatalog(query: PublicCatalogQueryDto) {
    const { keyword, category, minPrice, maxPrice, branchId } = query;
    const now = new Date();

    // Ràng buộc: Chiến dịch phải được phê duyệt và đang trong thời gian mở bán
    const whereClause: Prisma.VoucherCampaignWhereInput = {
      status: VoucherStatus.APPROVED,
      saleStartTime: { lte: now },
      saleEndTime: { gte: now },
    };

    if (category) {
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
      whereClause.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (branchId) {
      whereClause.campaignBranches = {
        some: {
          branchId: branchId,
        },
      };
    }

    const campaigns = await this.prisma.voucherCampaign.findMany({
      where: whereClause,
      include: {
        partner: {
          select: { companyName: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lọc bỏ những chiến dịch đã hết hàng trong kho (Đã bán >= Sức chứa)
    return campaigns.filter((c) => c.soldQuantity < c.capacity);
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
      where: { customerId },
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
    return {
      codeId: voucher.codeId,
      uniqueCode: voucher.uniqueCode,
      status: voucher.status,
      issuedAt: voucher.issuedAt,
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
    return this.prisma.$transaction(async (tx) => {
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
      if (voucher.status !== 'AVAILABLE') {
        throw new BadRequestException('Mã voucher này đã được sử dụng hoặc đã bị hủy/hết hạn.');
      }

      // 5. Kiểm tra thời hạn sử dụng của voucher (RB-08)
      const now = new Date();
      if (now < campaign.usageStartTime || now > campaign.usageEndTime) {
        throw new BadRequestException('Voucher đã hết hạn sử dụng hoặc chưa đến thời gian áp dụng.');
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
  }
}

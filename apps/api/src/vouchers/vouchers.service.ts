import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { VoucherStatus, PartnerApprovalStatus } from '@prisma/client';

/**
 * Service quản lý toàn bộ nghiệp vụ tạo, cập nhật, chuyển đổi trạng thái (vòng đời) chiến dịch Voucher.
 */
@Injectable()
export class VouchersService {
  constructor(private prisma: PrismaService) {}

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
  async findPublicCatalog(query: {
    keyword?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    branchId?: string;
  }) {
    const { keyword, category, minPrice, maxPrice, branchId } = query;
    const now = new Date();

    // Ràng buộc: Chiến dịch phải được phê duyệt và đang trong thời gian mở bán
    const whereClause: any = {
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
  async adminApproveCampaign(campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Chiến dịch voucher cần duyệt không tồn tại.');
    }

    if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Chỉ có thể phê duyệt chiến dịch voucher đang ở trạng thái Chờ phê duyệt.');
    }

    return this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.APPROVED },
    });
  }

  /**
   * Admin: Từ chối phê duyệt voucher chiến dịch thành REJECTED.
   */
  async adminRejectCampaign(campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Chiến dịch voucher cần từ chối không tồn tại.');
    }

    if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Chỉ có thể từ chối chiến dịch voucher đang ở trạng thái Chờ phê duyệt.');
    }

    return this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.REJECTED },
    });
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
}

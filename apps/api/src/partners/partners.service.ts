import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerApprovalStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

/**
 * Service quản lý logic nghiệp vụ cho Đối tác (Partner) và Chi nhánh (Branch).
 */
@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Lấy thông tin hồ sơ doanh nghiệp của đối tác kèm thông tin tài khoản user.
   */
  async getProfile(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác.');
    }

    return partner;
  }

  /**
   * Cập nhật thông tin hồ sơ đối tác.
   */
  async updateProfile(partnerId: string, updatePartnerDto: UpdatePartnerDto) {
    const { companyName, taxCode, representative } = updatePartnerDto;

    // Kiểm tra trùng mã số thuế nếu có cập nhật
    if (taxCode) {
      const existing = await this.prisma.partner.findFirst({
        where: {
          taxCode,
          NOT: { partnerId },
        },
      });
      if (existing) {
        throw new ConflictException('Mã số thuế này đã được đăng ký bởi doanh nghiệp khác.');
      }
    }

    return this.prisma.partner.update({
      where: { partnerId },
      data: {
        companyName,
        taxCode,
        representative,
      },
    });
  }

  /**
   * Lấy danh sách toàn bộ chi nhánh của đối tác.
   */
  async getBranches(partnerId: string) {
    return this.prisma.branch.findMany({
      where: { partnerId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tạo chi nhánh mới cho đối tác.
   */
  async createBranch(partnerId: string, createBranchDto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        partnerId,
        name: createBranchDto.name,
        address: createBranchDto.address,
        latitude: createBranchDto.latitude,
        longitude: createBranchDto.longitude,
      },
    });
  }

  /**
   * Cập nhật thông tin chi nhánh của đối tác.
   */
  async updateBranch(partnerId: string, branchId: string, updateBranchDto: UpdateBranchDto) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu của đối tác này
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException('Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.');
    }

    return this.prisma.branch.update({
      where: { branchId },
      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
        latitude: updateBranchDto.latitude,
        longitude: updateBranchDto.longitude,
      },
    });
  }

  /**
   * Xóa chi nhánh của đối tác.
   */
  async deleteBranch(partnerId: string, branchId: string) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
      include: {
        campaignBranches: true,
        staff: true,
      },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException('Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.');
    }

    // RB-09: Chặn xóa nếu chi nhánh đang được liên kết với chiến dịch voucher hoặc có nhân viên
    if (branch.campaignBranches.length > 0) {
      throw new BadRequestException('Không thể xóa chi nhánh đang liên kết với các chương trình voucher.');
    }

    if (branch.staff.length > 0) {
      throw new BadRequestException('Không thể xóa chi nhánh đang có nhân viên quét mã trực thuộc.');
    }

    return this.prisma.branch.delete({
      where: { branchId },
    });
  }

  // ================= ADMIN OPERATIONS =================

  /**
   * Admin: Lấy danh sách toàn bộ đối tác trên hệ thống kèm thông tin tài khoản để kiểm tra duyệt.
   */
  async adminListPartners() {
    return this.prisma.partner.findMany({
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Phê duyệt đối tác (Duyệt hồ sơ & Kích hoạt tài khoản).
   */
  async adminApprovePartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác cần duyệt.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái phê duyệt của đối tác thành APPROVED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.APPROVED },
      });

      // 2. Kích hoạt tài khoản User tương ứng thành ACTIVE (để đăng nhập được)
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.ACTIVE },
      });

      return updatedPartner;
    });

    await this.auditService.logAction(adminId, 'APPROVE_PARTNER', 'Partner', partnerId);
    return res;
  }

  /**
   * Admin: Từ chối phê duyệt đối tác.
   */
  async adminRejectPartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái thành REJECTED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.REJECTED },
      });

      // 2. Khóa tài khoản User tương ứng để chặn đăng nhập
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.LOCKED },
      });

      return updatedPartner;
    });

    await this.auditService.logAction(adminId, 'REJECT_PARTNER', 'Partner', partnerId);
    return res;
  }
}

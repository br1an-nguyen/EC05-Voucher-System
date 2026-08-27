import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityCategory, Prisma, UserRole } from '@prisma/client';

/**
 * Service ghi nhận nhật ký kiểm toán (Audit Logs) cho quản trị viên và nhật ký hoạt động (Activity Logs) cho toàn hệ thống.
 * Đảm bảo không nuốt lỗi kiểm toán để đáp ứng yêu cầu NFR-06.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ghi nhận lịch sử hoạt động quản trị của Admin.
   * Ném ngoại lệ khi gặp lỗi để đảm bảo tính toàn vẹn nhật ký kiểm toán.
   * @param adminId ID quản trị viên thực hiện hành động
   * @param actionType Loại hành động (vd: 'APPROVE_VOUCHER', 'REJECT_VOUCHER', 'UPDATE_USER_ROLE')
   * @param targetEntity Tên thực thể bị tác động (vd: 'VoucherCampaign', 'User')
   * @param targetId ID của thực thể bị tác động
   */
  async logAction(
    adminId: string,
    actionType: string,
    targetEntity: string,
    targetId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const admin = await db.user.findUnique({
      where: { userId: adminId },
    });

    if (!admin) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản admin với ID: ${adminId}`,
      );
    }

    const log = await db.auditLog.create({
      data: {
        adminId,
        adminNameSnapshot: admin.fullName || 'Unknown Admin',
        adminEmailSnapshot: admin.email,
        actionType,
        targetEntity,
        targetId,
      },
    });

    this.logger.log(
      `[AuditLog] Admin ${admin.fullName} (${admin.email}) thực hiện: ${actionType} trên ${targetEntity} (${targetId})`,
    );
    return log;
  }

  /**
   * Ghi nhận lịch sử hoạt động tổng thể của người dùng/hệ thống (ActivityLog).
   * @param data Thông tin hoạt động cần ghi nhận
   */
  async logActivity(
    data: {
      actorUserId?: string | null;
      actorRoleSnapshot?: UserRole | null;
      category: ActivityCategory;
      actionType: string;
      targetEntity: string;
      targetId?: string | null;
      metadata?: Prisma.InputJsonValue;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const log = await db.activityLog.create({
      data: {
        actorUserId: data.actorUserId || null,
        actorRoleSnapshot: data.actorRoleSnapshot || null,
        category: data.category,
        actionType: data.actionType,
        targetEntity: data.targetEntity,
        targetId: data.targetId || null,
        metadata: data.metadata ?? undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });

    this.logger.log(
      `[ActivityLog] [${data.category}] ${data.actionType} trên ${data.targetEntity} (${data.targetId})`,
    );
    return log;
  }

  /**
   * Lấy danh sách nhật ký kiểm toán (Audit Logs) cho trang quản trị Admin.
   */
  async getAdminLogs() {
    return this.prisma.auditLog.findMany({
      include: {
        admin: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}

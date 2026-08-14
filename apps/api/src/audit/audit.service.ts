import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ghi nhận lịch sử hoạt động quản trị của Admin (Idempotent Audit Logging).
   * @param adminId ID quản trị viên thực hiện hành động
   * @param actionType Loại hành động (vd: 'APPROVE_VOUCHER', 'REJECT_VOUCHER', 'APPROVE_PARTNER')
   * @param targetEntity Tên bảng/thực thể bị tác động
   * @param targetId ID của thực thể bị tác động
   */
  async logAction(adminId: string, actionType: string, targetEntity: string, targetId: string | null) {
    try {
      // Tìm thông tin của admin để lấy snapshot tên và email lúc thực hiện
      const admin = await this.prisma.user.findUnique({
        where: { userId: adminId },
      });

      if (!admin) {
        throw new NotFoundException(`Không tìm thấy tài khoản admin với ID: ${adminId}`);
      }

      const log = await this.prisma.auditLog.create({
        data: {
          adminId,
          adminNameSnapshot: admin.fullName || 'Unknown Admin',
          adminEmailSnapshot: admin.email,
          actionType,
          targetEntity,
          targetId,
        },
      });

      this.logger.log(`[AuditLog] Admin ${admin.fullName} (${admin.email}) thực hiện: ${actionType} trên ${targetEntity} (${targetId})`);
      return log;
    } catch (err: any) {
      this.logger.error(`Lỗi khi ghi nhận audit log cho admin ${adminId}:`, err.stack);
    }
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

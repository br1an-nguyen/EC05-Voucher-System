import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ExpiryProcessor {
  private readonly logger = new Logger(ExpiryProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Bộ quét định kỳ (mỗi 30 giây) để quét và hủy các đơn hàng giữ chỗ hết hạn thanh toán.
   * Giải phóng số lượng tồn kho đã giữ (decrement reservedStock).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleExpiredReservations() {
    const now = new Date();

    // Bước 1: Tìm tất cả phiếu giữ chỗ ACTIVE đã quá hạn
    const expiredReservations = await this.prisma.inventoryReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: now },
      },
    });

    if (expiredReservations.length === 0) {
      return;
    }

    this.logger.log(`Tìm thấy ${expiredReservations.length} phiếu giữ chỗ tồn kho hết hạn. Tiến hành giải phóng...`);

    // Bước 2: Duyệt qua từng phiếu giữ chỗ và giải phóng trong transaction
    for (const res of expiredReservations) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Cập nhật trạng thái phiếu giữ chỗ thành EXPIRED
          await tx.inventoryReservation.update({
            where: { reservationId: res.reservationId },
            data: { status: ReservationStatus.EXPIRED },
          });

          // 2. Giảm số lượng reservedStock của voucher chiến dịch tương ứng
          await tx.voucherCampaign.update({
            where: { campaignId: res.campaignId },
            data: {
              reservedStock: { decrement: res.quantity },
            },
          });

          // 3. Cập nhật đơn hàng sang trạng thái CANCELLED nếu vẫn chưa thanh toán
          const order = await tx.order.findUnique({
            where: { orderId: res.orderId },
          });

          if (order && order.paymentStatus === PaymentStatus.UNPAID && order.orderStatus === OrderStatus.PENDING) {
            await tx.order.update({
              where: { orderId: res.orderId },
              data: {
                orderStatus: OrderStatus.CANCELLED,
              },
            });
            this.logger.log(`Đã hủy đơn hàng quá hạn thanh toán: ${order.orderCode}`);
          }
        });
      } catch (err: any) {
        this.logger.error(
          `Lỗi khi hủy phiếu giữ chỗ ${res.reservationId} của đơn hàng ${res.orderId}:`,
          err.stack,
        );
      }
    }
  }
}

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus, ReservationStatus, PaymentTransactionStatus, VoucherCodeStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentFinalizationService {
  private readonly logger = new Logger(PaymentFinalizationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Hoàn tất giao dịch thanh toán và phát hành mã voucher (Idempotent).
   * Sử dụng SELECT FOR UPDATE để khóa dòng đơn hàng và các chiến dịch voucher.
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param providerTransactionId ID giao dịch từ cổng thanh toán bên thứ ba (Stripe/PayPal/VNPay)
   * @param settlement Thông tin quyết toán ngoại tệ thực tế (nếu có, ví dụ USD từ PayPal)
   */
  async finalizePayment(
    paymentId: string,
    providerTransactionId: string,
    settlement?: {
      settledAmountMinor: bigint;
      settledCurrency: string;
      exchangeRate?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Khóa và đọc dòng giao dịch thanh toán
      await tx.$executeRawUnsafe(
        `SELECT payment_id FROM "Payment_Transactions" WHERE payment_id = $1::uuid FOR UPDATE`,
        paymentId,
      );

      const payment = await tx.paymentTransaction.findUnique({
        where: { paymentId },
        include: {
          order: {
            include: {
              orderItems: {
                include: { campaign: true },
              },
              inventoryReservations: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
      }

      // Nếu giao dịch đã hoàn thành thành công trước đó (Replay Protection)
      if (payment.status === PaymentTransactionStatus.SUCCEEDED) {
        this.logger.log(`Giao dịch thanh toán ${paymentId} đã hoàn tất thành công từ trước.`);
        return payment.order;
      }

      const order = payment.order;

      // Cảnh báo nếu đơn hàng đã bị worker hủy trước đó, tiến hành khôi phục đơn
      if (order.orderStatus === OrderStatus.CANCELLED) {
        this.logger.warn(
          `Đơn hàng ${order.orderCode} đã bị hủy trước đó nhưng nhận được thanh toán thành công. Tiến hành khôi phục đơn hàng.`,
        );
      }

      // 2. Khóa dòng đơn hàng và các voucher chiến dịch để đảm bảo nhất quán dữ liệu
      await tx.$executeRawUnsafe(
        `SELECT order_id FROM "Orders" WHERE order_id = $1::uuid FOR UPDATE`,
        order.orderId,
      );

      for (const item of order.orderItems) {
        await tx.$executeRawUnsafe(
          `SELECT campaign_id FROM "Voucher_Campaigns" WHERE campaign_id = $1::uuid FOR UPDATE`,
          item.campaignId,
        );
      }

      // 3. Cập nhật trạng thái giao dịch thanh toán thành SUCCEEDED
      const settledAmountMinor = settlement ? settlement.settledAmountMinor : payment.requestAmountMinor;
      const settledCurrency = settlement ? settlement.settledCurrency : payment.requestCurrency;
      const exchangeRate = settlement?.exchangeRate ? settlement.exchangeRate : null;

      await tx.paymentTransaction.update({
        where: { paymentId },
        data: {
          status: PaymentTransactionStatus.SUCCEEDED,
          providerTransactionId,
          paidAt: new Date(),
          settledAmountMinor,
          settledCurrency,
          exchangeRate,
        },
      });

      // 4. Cập nhật trạng thái thanh toán đơn hàng thành PAID, trạng thái đơn thành CONFIRMED
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.CONFIRMED,
        },
      });

      // 5. Chuyển đổi trạng thái phiếu giữ chỗ từ ACTIVE thành COMMITTED
      for (const item of order.orderItems) {
        const reservation = order.inventoryReservations.find((r) => r.campaignId === item.campaignId);

        if (reservation && reservation.status === ReservationStatus.ACTIVE) {
          // Commit phiếu giữ chỗ
          await tx.inventoryReservation.update({
            where: { reservationId: reservation.reservationId },
            data: { status: ReservationStatus.COMMITTED },
          });

          // Giải phóng giữ chỗ và chuyển sang số lượng đã bán thực tế
          await tx.voucherCampaign.update({
            where: { campaignId: item.campaignId },
            data: {
              reservedStock: { decrement: item.quantity },
              soldQuantity: { increment: item.quantity },
            },
          });
        } else {
          // Trường hợp đặc biệt: Phiếu giữ chỗ đã hết hạn và bị giải phóng bởi cron job trước đó,
          // nhưng giao dịch thanh toán từ cổng vẫn thành công. Để bảo vệ quyền lợi người mua,
          // hệ thống vẫn ghi nhận số lượng đã bán mới trực tiếp (bán lố tạm thời) và log cảnh báo.
          await tx.voucherCampaign.update({
            where: { campaignId: item.campaignId },
            data: {
              soldQuantity: { increment: item.quantity },
            },
          });
          this.logger.warn(
            `Đơn hàng ${order.orderCode} thanh toán sau khi hết hạn giữ chỗ. Tiến hành phát hành mã khẩn cấp.`,
          );
        }
      }

      // 6. Phát hành mã Voucher Code ngẫu nhiên bảo mật (độ dài 12 ký tự) (RB-05, RB-06)
      for (const item of order.orderItems) {
        for (let i = 0; i < item.quantity; i++) {
          // Tạo mã ngẫu nhiên cryptographically secure bằng Node.js crypto
          const uniqueCode = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 ký tự hex

          await tx.voucherCode.create({
            data: {
              itemId: item.itemId,
              uniqueCode,
              customerId: order.customerId,
              status: VoucherCodeStatus.AVAILABLE,
              issuedAt: new Date(),
            },
          });
        }
      }

      this.logger.log(`Hoàn tất thanh toán đơn hàng ${order.orderCode}. Đã phát hành mã voucher thành công.`);
      return updatedOrder;
    });
  }
}

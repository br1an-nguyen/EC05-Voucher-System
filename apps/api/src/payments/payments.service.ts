import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentProviderType,
  PaymentTransactionStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng (Payment Attempt).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param orderId ID đơn hàng cần thanh toán
   * @param provider Loại cổng thanh toán (STRIPE, PAYPAL, VNPAY)
   */
  async createPaymentAttempt(customerId: string, orderId: string, provider: PaymentProviderType) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT order_id FROM "Orders" WHERE order_id = $1::uuid FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: { paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
      }

    // Bước 2: Ràng buộc trạng thái đơn hàng (chỉ thanh toán đơn PENDING và UNPAID)
      if (order.orderStatus !== OrderStatus.PENDING || order.paymentStatus !== PaymentStatus.UNPAID) {
        throw new BadRequestException('Đơn hàng này không ở trạng thái chờ thanh toán.');
      }

    // Bước 3: Ràng buộc thời gian giữ chỗ tồn kho (RB-15)
      const now = new Date();
      if (now > order.reservationExpiresAt) {
        throw new BadRequestException('Thời gian giữ chỗ thanh toán của đơn hàng đã hết hạn. Vui lòng đặt lại đơn mới.');
      }

    // Bước 4: Tính số lượt thử thanh toán (attemptNo)
      const attemptNo = order.paymentTransactions.length + 1;
      const idempotencyKey = `IDEM-${order.orderId}-${attemptNo}-${Date.now()}`;

      // Bước 4.5: Cập nhật các giao dịch cũ ở trạng thái CREATED thành FAILED để giải phóng chỉ mục duy nhất
      await tx.paymentTransaction.updateMany({
        where: {
          orderId: order.orderId,
          status: PaymentTransactionStatus.CREATED,
        },
        data: {
          status: PaymentTransactionStatus.FAILED,
          failureCode: 'SUPERSEDED',
          failureMessage: 'Giao dịch cũ bị hủy do khởi tạo lượt thanh toán mới.',
        },
      });

    // Bước 5: Khởi tạo giao dịch thanh toán mới trong DB
      const requestAmountMinor = BigInt(Math.round(Number(order.totalAmount)));

      const payment = await tx.paymentTransaction.create({
        data: {
          orderId: order.orderId,
          provider,
          attemptNo,
          status: PaymentTransactionStatus.CREATED,
          idempotencyKey,
          baseAmount: order.totalAmount,
          requestAmountMinor,
          requestCurrency: 'VND',
          expiresAt: order.reservationExpiresAt,
        },
        include: {
          order: true,
        },
      });

    // Cập nhật cổng thanh toán đang chọn trên đơn hàng
      await tx.order.update({
        where: { orderId: order.orderId },
        data: { selectedPaymentProvider: provider },
      });

      return payment;
    });
  }

  /**
   * Lấy chi tiết trạng thái giao dịch thanh toán để hiển thị giao diện.
   * @param paymentId ID giao dịch thanh toán cục bộ
   */
  async getPaymentDetails(paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async getPaymentDetailsForActor(
    paymentId: string,
    actor: { userId: string; role: UserRole },
  ) {
    const payment = await this.getPaymentDetails(paymentId);
    if (actor.role !== UserRole.ADMIN && payment.order.customerId !== actor.userId) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async assertPaymentOwner(paymentId: string, customerId: string): Promise<void> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      select: { paymentId: true },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }
  }

  /**
   * Cập nhật mã định danh đơn hàng từ cổng thanh toán đối tác (Stripe Session ID, PayPal Order ID, v.v.).
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param providerOrderId ID đơn hàng nhận được từ phía đối tác thanh toán
   * @returns Bản ghi giao dịch thanh toán sau khi cập nhật
   */
  async updateProviderOrderId(paymentId: string, providerOrderId: string) {
    return this.prisma.paymentTransaction.update({
      where: { paymentId },
      data: { providerOrderId },
    });
  }

  /**
   * Tìm giao dịch thanh toán theo ID đơn hàng từ phía đối tác (providerOrderId).
   * @param providerOrderId ID đơn hàng của cổng thanh toán
   */
  async getPaymentByProviderOrderId(providerOrderId: string) {
    return this.prisma.paymentTransaction.findFirst({
      where: { providerOrderId },
      include: { order: true },
    });
  }

  /**
   * Đăng ký và lưu sự kiện webhook từ đối tác thanh toán, đảm bảo tính idempotent (chống replay).
   * @param provider Loại cổng thanh toán
   * @param providerEventId ID sự kiện duy nhất từ cổng thanh toán
   * @param eventType Tên loại sự kiện
   * @param payload Dữ liệu payload của webhook
   * @returns True nếu sự kiện được ghi nhận mới, False nếu sự kiện đã tồn tại (bị trùng)
   */
  async registerWebhookEvent(
    provider: PaymentProviderType,
    providerEventId: string,
    eventType: string,
    payload: any,
  ): Promise<boolean> {
    try {
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider,
          providerEventId,
          eventType,
          signatureValid: true,
          payloadHash,
          processingStatus: 'PROCESSED',
          receivedAt: new Date(),
          processedAt: new Date(),
        },
      });
      return true;
    } catch (err: any) {
      // P2002: Lỗi vi phạm ràng buộc duy nhất (Unique constraint failed) -> Sự kiện trùng lặp
      if (err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Cập nhật trạng thái giao dịch thanh toán thành FAILED với mã lỗi và thông điệp tương ứng.
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param failureCode Mã lỗi thất bại
   * @param failureMessage Chi tiết thông báo thất bại
   */
  async updatePaymentStatusFailed(paymentId: string, failureCode: string, failureMessage: string) {
    return this.prisma.paymentTransaction.update({
      where: { paymentId },
      data: {
        status: PaymentTransactionStatus.FAILED,
        failureCode,
        failureMessage,
      },
    });
  }
}

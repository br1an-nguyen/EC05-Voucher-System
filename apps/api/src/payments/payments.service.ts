import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProviderType, PaymentTransactionStatus, OrderStatus, PaymentStatus } from '@prisma/client';

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
    // Bước 1: Kiểm tra đơn hàng có tồn tại và thuộc quyền sở hữu của người dùng không
    const order = await this.prisma.order.findFirst({
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

    // Bước 5: Khởi tạo giao dịch thanh toán mới trong DB
    const requestAmountMinor = BigInt(Math.round(Number(order.totalAmount))); // Số tiền dưới dạng số nguyên nhỏ

    const payment = await this.prisma.paymentTransaction.create({
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
    });

    // Cập nhật cổng thanh toán đang chọn trên đơn hàng
    await this.prisma.order.update({
      where: { orderId: order.orderId },
      data: { selectedPaymentProvider: provider },
    });

    return payment;
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
}

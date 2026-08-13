import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, PaymentProviderType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreatePaymentAttemptDto {
  @IsEnum(PaymentProviderType, { message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, VNPAY).' })
  provider: PaymentProviderType;
}

/**
 * Controller tiếp nhận REST API điều phối giao dịch thanh toán.
 * POST /payments/:orderId (tạo attempt), POST /payments/:paymentId/mock-success (mô phỏng thanh toán thành công)
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private paymentFinalizationService: PaymentFinalizationService,
  ) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng.
   * POST /payments/:orderId
   */
  @Post(':orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async createPaymentAttempt(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: CreatePaymentAttemptDto,
  ) {
    const payment = await this.paymentsService.createPaymentAttempt(
      req.user.userId,
      orderId,
      dto.provider,
    );

    // Ở commit này, do chưa tích hợp các bộ chuyển hướng API thật của Stripe/PayPal/VNPay,
    // chúng ta sẽ trả về một Mock Payment URL trỏ về trang kết quả mô phỏng.
    const mockPaymentUrl = `/payments/return/mock?paymentId=${payment.paymentId}`;

    return {
      paymentId: payment.paymentId,
      provider: payment.provider,
      mockPaymentUrl,
    };
  }

  /**
   * Xem chi tiết trạng thái giao dịch thanh toán.
   * GET /payments/:paymentId/status
   */
  @Get(':paymentId/status')
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    const payment = await this.paymentsService.getPaymentDetails(paymentId);
    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      paidAt: payment.paidAt,
    };
  }

  /**
   * API Mô phỏng (Developer tool): Giúp kích hoạt thanh toán thành công để kiểm tra tính nhất quán,
   * kiểm tra việc giảm reservedStock, tăng soldQuantity và tự động phát hành Voucher Codes.
   * POST /payments/:paymentId/mock-success
   */
  @Post(':paymentId/mock-success')
  async mockSuccess(@Param('paymentId') paymentId: string) {
    const providerTransactionId = `MOCK-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const order = await this.paymentFinalizationService.finalizePayment(paymentId, providerTransactionId);
    return {
      message: 'Mô phỏng thanh toán thành công!',
      orderId: order.orderId,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    };
  }
}

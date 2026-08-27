import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  BadGatewayException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  UserRole,
  PaymentProviderType,
  PaymentTransactionStatus,
  OrderStatus,
} from '@prisma/client';
import { IsEnum } from 'class-validator';

import { VnPayAdapter } from './adapters/vnpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';
import { PaypalCaptureDto } from './dto/paypal-capture.dto';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeConfigService } from './stripe.config';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user: { userId: string; role: UserRole };
};

export class CreatePaymentAttemptDto {
  @IsEnum(PaymentProviderType, {
    message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, VNPAY).',
  })
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
    private vnPayAdapter: VnPayAdapter,
    private stripeAdapter: StripeAdapter,
    private paypalAdapter: PaypalAdapter,
    private stripeWebhookService: StripeWebhookService,
    private stripeConfig: StripeConfigService,
  ) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng.
   * POST /payments/:orderId
   */
  @Post(':orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async createPaymentAttempt(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: CreatePaymentAttemptDto,
  ) {
    const payment = await this.paymentsService.createPaymentAttempt(
      req.user.userId,
      orderId,
      dto.provider,
    );

    let paymentUrl = `/payments/return/mock?paymentId=${payment.paymentId}`;

    if (payment.provider === PaymentProviderType.VNPAY) {
      const res = await this.vnPayAdapter.createPayment(
        payment,
        payment.order.orderCode,
        req.ip || req.socket?.remoteAddress,
      );
      await this.paymentsService.bindVnPayReference(
        payment.paymentId,
        res.providerOrderId,
      );
      paymentUrl = res.paymentUrl;
    } else if (payment.provider === PaymentProviderType.STRIPE) {
      let res;
      try {
        res = await this.stripeAdapter.createPayment(
          payment,
          payment.order.orderCode,
        );
      } catch (error: unknown) {
        await this.paymentsService.failStripeSessionCreation(
          payment.paymentId,
          error,
        );
        throw new BadGatewayException(
          'Không thể khởi tạo phiên thanh toán Stripe.',
        );
      }
      try {
        await this.paymentsService.bindStripeSession(
          payment.paymentId,
          res.providerOrderId,
        );
      } catch (error: unknown) {
        try {
          await this.stripeAdapter.expireSession(res.providerOrderId);
        } catch {
          // Best effort only: preserve the original local binding error.
        }
        throw error;
      }
      paymentUrl = res.paymentUrl;
    } else if (payment.provider === PaymentProviderType.PAYPAL) {
      const res = await this.paypalAdapter.createPayment(
        payment,
        payment.order.orderCode,
      );
      paymentUrl = res.paymentUrl;
      if (res.providerOrderId) {
        await this.paymentsService.updateProviderOrderId(
          payment.paymentId,
          res.providerOrderId,
        );
      }
    }

    return {
      paymentId: payment.paymentId,
      provider: payment.provider,
      paymentUrl,
    };
  }

  /**
   * Xem chi tiết trạng thái giao dịch thanh toán.
   * GET /payments/:paymentId/status
   */
  @Get(':paymentId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async getPaymentStatus(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.getPaymentDetailsForActor(
      paymentId,
      req.user,
    );
    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      paidAt: payment.paidAt,
      isGift: payment.order.isGift,
      recipientEmail: payment.order.recipientEmail,
    };
  }

  /**
   * API Mô phỏng (Developer tool): Giúp kích hoạt thanh toán thành công để kiểm tra tính nhất quán,
   * kiểm tra việc giảm reservedStock, tăng soldQuantity và tự động phát hành Voucher Codes.
   * POST /payments/:paymentId/mock-success
   */
  @Post(':paymentId/mock-success')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async mockSuccess(@Req() req: any, @Param('paymentId') paymentId: string) {
    if (!this.stripeConfig.isSimulated()) {
      throw new ForbiddenException(
        'Endpoint mô phỏng chỉ hoạt động khi PAYMENT_MODE=SIMULATED.',
      );
    }

    await this.paymentsService.getPaymentDetailsForActor(paymentId, req.user);

    const providerTransactionId = `MOCK-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const order = await this.paymentFinalizationService.finalizePayment(
      paymentId,
      providerTransactionId,
    );
    return {
      message: 'Mô phỏng thanh toán thành công!',
      orderId: order.orderId,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    };
  }

  /**
   * Xác minh Return URL để hiển thị. Endpoint này tuyệt đối không hoàn tất đơn.
   * GET /payments/vnpay/return
   */
  @Get('vnpay/return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async verifyVnPayReturn(@Req() req: AuthenticatedRequest) {
    const result = await this.vnPayAdapter.verifyAndParseNotification(
      req.query,
    );
    if (!result.signatureValid || !result.transactionReference) {
      return {
        state: 'FAILED',
        message: 'Chữ ký phản hồi VNPAY không hợp lệ.',
      };
    }

    const payment = await this.paymentsService.getPaymentDetailsForActor(
      result.transactionReference,
      req.user,
    );
    if (
      payment.provider !== PaymentProviderType.VNPAY ||
      payment.providerOrderId !== result.transactionReference
    ) {
      throw new BadRequestException('Giao dịch không thuộc cổng VNPAY.');
    }
    if (
      result.amountMinor !== payment.requestAmountMinor * 100n ||
      result.currency !== payment.requestCurrency
    ) {
      return {
        state: 'FAILED',
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        message: 'Số tiền hoặc loại tiền phản hồi từ VNPAY không hợp lệ.',
      };
    }

    let state: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' = 'PENDING';
    if (payment.status === PaymentTransactionStatus.SUCCEEDED) {
      state = 'SUCCESS';
    } else if (
      payment.status === PaymentTransactionStatus.CANCELLED ||
      result.responseCode === '24'
    ) {
      state = 'CANCELLED';
    } else if (payment.status === PaymentTransactionStatus.FAILED) {
      state = 'FAILED';
    } else if (
      result.status === 'FAILED' &&
      (result.responseCode !== '00' || result.transactionStatus !== '00')
    ) {
      state = 'FAILED';
    }

    return {
      state,
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      paymentStatus: payment.status,
      message:
        state === 'PENDING' ? 'Đang chờ VNPAY gửi xác nhận IPN.' : undefined,
    };
  }

  /**
   * VNPay IPN (Instant Payment Notification) Callback.
   * Cổng thanh toán gọi API này ẩn dưới nền để đồng bộ trạng thái thanh toán.
   * GET /payments/vnpay/ipn
   */
  @Get('vnpay/ipn')
  async handleVnPayIpn(@Req() req: Request) {
    try {
      const result = await this.vnPayAdapter.verifyAndParseNotification(
        req.query,
      );
      if (!result.signatureValid) {
        return { RspCode: '97', Message: 'Invalid signature' };
      }
      const paymentId = result.transactionReference;
      if (!paymentId) {
        return { RspCode: '01', Message: 'Order not found' };
      }

      let payment;
      try {
        payment = await this.paymentsService.getPaymentDetails(paymentId);
      } catch {
        return { RspCode: '01', Message: 'Order not found' };
      }

      if (
        payment.provider !== PaymentProviderType.VNPAY ||
        payment.providerOrderId !== paymentId
      ) {
        return { RspCode: '01', Message: 'Order not found' };
      }

      if (
        result.amountMinor !== payment.requestAmountMinor * 100n ||
        result.currency !== payment.requestCurrency ||
        result.currency !== 'VND'
      ) {
        return { RspCode: '04', Message: 'Invalid amount' };
      }

      if (
        payment.status === PaymentTransactionStatus.SUCCEEDED ||
        payment.status === PaymentTransactionStatus.FAILED ||
        payment.status === PaymentTransactionStatus.CANCELLED
      ) {
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      if (
        result.responseCode === '00' &&
        result.transactionStatus === '00' &&
        result.providerTransactionId
      ) {
        await this.paymentFinalizationService.finalizePayment(
          paymentId,
          result.providerTransactionId,
        );
        return { RspCode: '00', Message: 'Confirm Success' };
      }

      await this.paymentsService.markVnPayFailed(
        paymentId,
        result.responseCode || result.transactionStatus || 'UNKNOWN',
        result.providerTransactionId,
      );
      return { RspCode: '00', Message: 'Confirm Success' };
    } catch {
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  /**
   * Stripe Webhook Callback.
   * Tiếp nhận các sự kiện từ Stripe gửi về (bao gồm thành công checkout session).
   * POST /payments/stripe/webhook
   */
  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Req() req: any) {
    const signatureHeader = req.headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Invalid Stripe webhook request.');
    }

    let event;
    try {
      event = this.stripeAdapter.verifyWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    return this.stripeWebhookService.processEvent(event, req.rawBody);
  }

  /**
   * PayPal Capture Callback.
   * Gọi API này để thực thi capture (bắt tiền) đơn hàng sau khi khách hàng đồng ý.
   * POST /payments/paypal/capture
   */
  @Post('paypal/capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async handlePaypalCapture(@Req() req: any, @Body() dto: PaypalCaptureDto) {
    // 1. Xác minh người dùng sở hữu giao dịch thanh toán này
    await this.paymentsService.assertPaymentOwner(
      dto.paymentId,
      req.user.userId,
    );

    // Lấy chi tiết giao dịch để kiểm tra chéo (P0)
    const payment = await this.paymentsService.getPaymentDetails(dto.paymentId);

    // 2. Kiểm tra tính hợp lệ của giao dịch trước khi capture
    if (payment.provider !== PaymentProviderType.PAYPAL) {
      throw new BadRequestException(
        'Giao dịch thanh toán này không sử dụng cổng PayPal.',
      );
    }

    if (payment.providerOrderId !== dto.paypalOrderId) {
      throw new BadRequestException(
        'Mã đơn hàng PayPal đối tác không khớp với dữ liệu giao dịch.',
      );
    }

    if (payment.status === PaymentTransactionStatus.SUCCEEDED) {
      return {
        success: true,
        message: 'Thanh toán đã được xử lý thành công từ trước.',
        orderStatus: payment.order.orderStatus,
      };
    }

    if (payment.status !== PaymentTransactionStatus.CREATED) {
      throw new BadRequestException(
        'Giao dịch thanh toán không ở trạng thái hợp lệ để quét.',
      );
    }

    if (payment.order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Đơn hàng liên kết đã bị hủy do quá hạn thanh toán.',
      );
    }

    // 3. Thực thi bắt giữ tiền từ PayPal Sandbox API
    const result = await this.paypalAdapter.captureOrder(
      dto.paypalOrderId,
      dto.paymentId,
    );

    if (result.status !== 'SUCCESS') {
      throw new BadRequestException(
        'Không thể xác thực capture tiền thành công từ PayPal Sandbox.',
      );
    }

    // 4. Kiểm chứng số tiền và tiền tệ capture thực tế (P1)
    const expectedUsd = (Number(payment.baseAmount) / 25000).toFixed(2);
    const amountDifference = Math.abs(result.amountPaid - Number(expectedUsd));

    // Cho phép sai số làm tròn nhỏ do chuyển đổi VND -> USD (dưới 1 cent)
    if (amountDifference >= 0.01) {
      throw new BadRequestException(
        `Số tiền quyết toán không hợp lệ. Mong đợi ${expectedUsd} USD, thực nhận ${result.amountPaid} USD.`,
      );
    }

    if (result.currency !== 'USD') {
      throw new BadRequestException(
        `Định dạng tiền tệ quyết toán không hợp lệ (Mong đợi USD, nhận ${result.currency}).`,
      );
    }

    // 5. Tính toán minor unit và hoàn tất giao dịch trong DB transaction
    const settledAmountMinor = BigInt(Math.round(result.amountPaid * 100)); // USD cent minor unit

    const order = await this.paymentFinalizationService.finalizePayment(
      dto.paymentId,
      result.providerTransactionId,
      {
        settledAmountMinor,
        settledCurrency: 'USD',
        exchangeRate: 25000,
      },
    );

    return {
      success: true,
      message: 'Thanh toán PayPal thành công!',
      orderStatus: order.orderStatus,
    };
  }

  /**
   * PayPal Webhook Callback.
   * Cổng thanh toán gọi API này ẩn dưới nền để đồng bộ trạng thái thanh toán.
   * POST /payments/paypal/webhook
   */
  @Post('paypal/webhook')
  async handlePaypalWebhook(@Req() req: any) {
    const headers = req.headers;
    const body = req.body;

    // 1. Xác thực chữ ký số webhook
    const isValid = await this.paypalAdapter.verifyWebhookSignature(
      headers,
      body,
    );
    if (!isValid) {
      throw new BadRequestException('Chữ ký webhook PayPal không hợp lệ.');
    }

    // 2. Chống trùng lặp sự kiện (Replay protection)
    const providerEventId = body.id;
    const eventType = body.event_type;

    const isNewEvent = await this.paymentsService.registerWebhookEvent(
      PaymentProviderType.PAYPAL,
      providerEventId,
      eventType,
      body,
    );

    if (!isNewEvent) {
      return { received: true, status: 'REPLAY_IGNORED' };
    }

    // 3. Xử lý sự kiện capture thành công
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = body.resource;
      const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
      const captureId = resource.id;

      if (paypalOrderId) {
        const payment =
          await this.paymentsService.getPaymentByProviderOrderId(paypalOrderId);
        if (payment && payment.status !== PaymentTransactionStatus.SUCCEEDED) {
          const amountPaid = Number(resource.amount.value);
          const currency = resource.amount.currency_code;

          // Đối soát số tiền
          const expectedUsd = (Number(payment.baseAmount) / 25000).toFixed(2);
          if (
            Math.abs(amountPaid - Number(expectedUsd)) < 0.01 &&
            currency === 'USD'
          ) {
            const settledAmountMinor = BigInt(Math.round(amountPaid * 100));

            await this.paymentFinalizationService.finalizePayment(
              payment.paymentId,
              captureId,
              {
                settledAmountMinor,
                settledCurrency: 'USD',
                exchangeRate: 25000,
              },
            );
          } else {
            // Số tiền hoặc tiền tệ không khớp, đánh dấu giao dịch thất bại
            await this.paymentsService.updatePaymentStatusFailed(
              payment.paymentId,
              'AMOUNT_MISMATCH',
              `Webhook đối soát thất bại: Nhận ${amountPaid} ${currency}, mong đợi ${expectedUsd} USD.`,
            );
          }
        }
      }
    }

    return { received: true };
  }
}

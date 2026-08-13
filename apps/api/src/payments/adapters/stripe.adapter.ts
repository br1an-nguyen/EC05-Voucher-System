import { Injectable } from '@nestjs/common';
import { PaymentProvider, VerifiedPaymentResult } from '../interfaces/payment-provider.interface';
import { PaymentTransaction } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class StripeAdapter implements PaymentProvider {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51MockSecretKeyForDeveloperTestingPurposeOnly12345', {
    apiVersion: '2025-01-27' as any,
  });

  /**
   * Tạo Stripe Checkout Session.
   */
  async createPayment(payment: PaymentTransaction, orderCode: string): Promise<{ paymentUrl: string; providerOrderId?: string }> {
    const isVnd = payment.requestCurrency.toLowerCase() === 'vnd';
    
    // Trên Stripe: VND là zero-decimal (không nhân 100), các loại tiền tệ khác như USD nhân với 100
    const amountVal = isVnd
      ? Math.round(Number(payment.baseAmount))
      : Math.round(Number(payment.baseAmount) / 25000 * 100); // Quy đổi giả định 1 USD = 25,000 VND

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: payment.requestCurrency.toLowerCase(),
            product_data: {
              name: `Thanh toan don hang ${orderCode}`,
            },
            unit_amount: amountVal,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:3000/payments/return/stripe?session_id={CHECKOUT_SESSION_ID}&paymentId=${payment.paymentId}`,
      cancel_url: `http://localhost:3000/cart`,
      metadata: {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
      },
    });

    return {
      paymentUrl: session.url || '',
      providerOrderId: session.id,
    };
  }

  /**
   * Phân tích kết quả thanh toán từ Webhook đã xác thực.
   */
  async verifyAndParseNotification(event: any): Promise<VerifiedPaymentResult> {
    const stripeEvent = event as Stripe.Event;

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const isVnd = session.currency?.toLowerCase() === 'vnd';
      const amountPaid = isVnd 
        ? (session.amount_total || 0) 
        : (session.amount_total || 0) / 100;

      return {
        providerTransactionId: session.payment_intent as string || 'MOCK-STRIPE-TX',
        amountPaid,
        currency: session.currency || 'vnd',
        status: session.payment_status === 'paid' ? 'SUCCESS' : 'FAILED',
      };
    }

    return {
      providerTransactionId: '',
      amountPaid: 0,
      currency: '',
      status: 'FAILED',
    };
  }

  /**
   * Truy vấn trực tiếp trạng thái checkout session từ Stripe API.
   */
  async queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult> {
    const session = await this.stripe.checkout.sessions.retrieve(providerOrderId);
    const isVnd = session.currency?.toLowerCase() === 'vnd';
    const amountPaid = isVnd 
      ? (session.amount_total || 0) 
      : (session.amount_total || 0) / 100;

    return {
      providerTransactionId: session.payment_intent as string || 'QUERY-STRIPE-TX',
      amountPaid,
      currency: session.currency || 'vnd',
      status: session.payment_status === 'paid' ? 'SUCCESS' : 'FAILED',
    };
  }

  /**
   * Xác thực chữ ký webhook bằng thư viện Stripe.
   */
  verifyWebhookEvent(rawBody: Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}

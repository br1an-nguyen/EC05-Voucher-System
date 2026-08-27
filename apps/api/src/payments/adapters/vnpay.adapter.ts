import { Injectable } from '@nestjs/common';
import { PaymentTransaction } from '@prisma/client';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  VerifiedPaymentResult,
} from '../interfaces/payment-provider.interface';
import { VnPayConfigService } from '../vnpay.config';

type VnPayParams = Record<string, string>;

@Injectable()
export class VnPayAdapter implements PaymentProvider {
  constructor(private readonly config: VnPayConfigService) {}

  createPayment(
    payment: PaymentTransaction,
    orderCode: string,
    clientIp = '127.0.0.1',
  ): Promise<{ paymentUrl: string; providerOrderId: string }> {
    this.config.assertConfigured();
    if (payment.requestCurrency !== 'VND') {
      throw new Error('VNPAY only supports VND in this integration.');
    }

    const params: VnPayParams = {
      vnp_Version: this.config.version,
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: (payment.requestAmountMinor * 100n).toString(),
      vnp_CreateDate: this.formatDate(new Date()),
      vnp_CurrCode: payment.requestCurrency,
      vnp_IpAddr: this.normalizeIp(clientIp),
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${orderCode}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_TxnRef: payment.paymentId,
    };

    if (payment.expiresAt) {
      params.vnp_ExpireDate = this.formatDate(payment.expiresAt);
    }

    const signingPayload = this.toQueryString(params);
    const secureHash = this.sign(signingPayload);

    return Promise.resolve({
      paymentUrl: `${this.config.paymentUrl}?${signingPayload}&vnp_SecureHash=${secureHash}`,
      providerOrderId: payment.paymentId,
    });
  }

  verifyAndParseNotification(
    requestQuery: Record<string, unknown>,
  ): Promise<VerifiedPaymentResult> {
    this.config.assertConfigured();
    const params = this.toStringParams(requestQuery);
    const receivedHash = params.vnp_SecureHash || '';
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const calculatedHash = this.sign(this.toQueryString(params));
    const signatureValid = this.safeEqual(calculatedHash, receivedHash);
    const amountMinor = /^\d+$/.test(params.vnp_Amount || '')
      ? BigInt(params.vnp_Amount)
      : -1n;
    const responseCode = params.vnp_ResponseCode || '';
    const transactionStatus = params.vnp_TransactionStatus || '';

    return Promise.resolve({
      providerTransactionId: params.vnp_TransactionNo || '',
      amountPaid: Number(amountMinor) / 100,
      amountMinor,
      currency: params.vnp_CurrCode || '',
      status:
        signatureValid && responseCode === '00' && transactionStatus === '00'
          ? 'SUCCESS'
          : 'FAILED',
      signatureValid,
      responseCode,
      transactionStatus,
      transactionReference: params.vnp_TxnRef || '',
      bankCode: params.vnp_BankCode,
      payDate: params.vnp_PayDate,
    });
  }

  queryStatus(): Promise<VerifiedPaymentResult> {
    return Promise.reject(
      new Error('VNPAY queryDR is not configured for this Sandbox flow.'),
    );
  }

  private toStringParams(query: Record<string, unknown>): VnPayParams {
    const params: VnPayParams = {};
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        params[key] = value;
      } else if (Array.isArray(value) && typeof value[0] === 'string') {
        params[key] = value[0];
      }
    }
    return params;
  }

  private toQueryString(params: VnPayParams): string {
    return Object.keys(params)
      .filter((key) => params[key] !== '')
      .sort()
      .map((key) => `${this.encode(key)}=${this.encode(params[key])}`)
      .join('&');
  }

  private encode(value: string): string {
    return encodeURIComponent(value).replace(/%20/g, '+');
  }

  private sign(payload: string): string {
    return crypto
      .createHmac('sha512', this.config.hashSecret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  private safeEqual(expected: string, received: string): boolean {
    if (!/^[a-fA-F0-9]{128}$/.test(received)) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex'),
    );
  }

  private normalizeIp(ip: string): string {
    const firstIp = ip.split(',')[0]?.trim() || '127.0.0.1';
    if (firstIp === '::1') return '127.0.0.1';
    if (firstIp.startsWith('::ffff:')) return firstIp.slice(7);
    return firstIp;
  }

  private formatDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value || '';
    return `${value('year')}${value('month')}${value('day')}${value('hour')}${value('minute')}${value('second')}`;
  }
}

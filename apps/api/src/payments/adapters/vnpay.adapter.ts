import { Injectable } from '@nestjs/common';
import { PaymentProvider, VerifiedPaymentResult } from '../interfaces/payment-provider.interface';
import { PaymentTransaction } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class VnPayAdapter implements PaymentProvider {
  private readonly tmnCode = process.env.VNP_TMN_CODE || '2QX1X123';
  private readonly hashSecret = process.env.VNP_HASH_SECRET || 'SECRET123';
  private readonly vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  private readonly returnUrl = process.env.VNP_RETURN_URL || 'http://localhost:3000/payments/return/vnpay';

  /**
   * Tạo Payment URL chuyển hướng sang VNPay Sandbox.
   */
  async createPayment(payment: PaymentTransaction, orderCode: string): Promise<{ paymentUrl: string; providerOrderId?: string }> {
    const date = new Date();
    const createDate = this.formatDate(date);
    
    // VNPay yêu cầu số tiền nhân với 100 (đổi sang đơn vị xu/đồng nhỏ nhất)
    const amountVal = Math.round(Number(payment.baseAmount) * 100);

    const vnpParams: any = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: payment.paymentId, // Sử dụng paymentId làm mã giao dịch
      vnp_OrderInfo: `Thanh toan don hang ${orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: amountVal.toString(),
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: '127.0.0.1', // Địa chỉ IP giả lập
      vnp_CreateDate: createDate,
    };

    // Sắp xếp các tham số theo thứ tự alphabet để tính hash chữ ký bảo mật
    const sortedParams = this.sortObject(vnpParams);
    const queryString = Object.keys(sortedParams)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const secureHash = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');

    const paymentUrl = `${this.vnpUrl}?${queryString}&vnp_SecureHash=${secureHash}`;

    return {
      paymentUrl,
      providerOrderId: payment.paymentId,
    };
  }

  /**
   * Xác thực chữ ký và dữ liệu phản hồi từ VNPay Callback / IPN.
   */
  async verifyAndParseNotification(reqQuery: any): Promise<VerifiedPaymentResult> {
    const secureHash = reqQuery.vnp_SecureHash;

    const verifyParams = { ...reqQuery };
    delete verifyParams.vnp_SecureHash;
    delete verifyParams.vnp_SecureHashType;

    const sortedParams = this.sortObject(verifyParams);
    
    // VNPay yêu cầu encode khoảng trắng thành dấu cộng (+) khi verify signature
    const queryString = Object.keys(sortedParams)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, '+')}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const calculatedHash = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');

    const isValid = calculatedHash === secureHash;
    const responseCode = reqQuery.vnp_ResponseCode;

    return {
      providerTransactionId: reqQuery.vnp_TransactionNo || 'MOCK-VNP-TX',
      amountPaid: Number(reqQuery.vnp_Amount) / 100,
      currency: 'VND',
      status: isValid && responseCode === '00' ? 'SUCCESS' : 'FAILED',
    };
  }

  /**
   * Truy vấn trạng thái trực tiếp từ VNPay (Mock cho môi trường sandbox).
   */
  async queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult> {
    return {
      providerTransactionId: 'QUERY-VNP-TX',
      amountPaid: 0,
      currency: 'VND',
      status: 'SUCCESS',
    };
  }

  private sortObject(obj: any): any {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = obj[key];
    }
    return sorted;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }
}

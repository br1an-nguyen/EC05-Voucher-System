import { Injectable } from '@nestjs/common';

@Injectable()
export class VnPayConfigService {
  readonly version = process.env.VNP_VERSION?.trim() || '2.1.0';
  readonly paymentUrl =
    process.env.VNP_PAYMENT_URL?.trim() ||
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

  get tmnCode(): string {
    return this.required('VNP_TMN_CODE');
  }

  get hashSecret(): string {
    return this.required('VNP_HASH_SECRET');
  }

  get returnUrl(): string {
    return this.requiredUrl('VNP_RETURN_URL');
  }

  get ipnUrl(): string {
    return this.requiredUrl('VNP_IPN_URL');
  }

  assertConfigured(): void {
    void this.tmnCode;
    void this.hashSecret;
    void this.returnUrl;
    void this.ipnUrl;

    if (this.version !== '2.1.0') {
      throw new Error('VNP_VERSION must be 2.1.0 for this integration.');
    }

    let paymentUrl: URL;
    try {
      paymentUrl = new URL(this.paymentUrl);
    } catch {
      throw new Error('VNP_PAYMENT_URL must be a valid URL.');
    }
    if (paymentUrl.hostname !== 'sandbox.vnpayment.vn') {
      throw new Error('VNP_PAYMENT_URL must point to the VNPAY Sandbox host.');
    }
  }

  private required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required when using VNPAY.`);
    }
    return value;
  }

  private requiredUrl(name: string): string {
    const value = this.required(name);
    try {
      return new URL(value).toString();
    } catch {
      throw new Error(`${name} must be a valid absolute URL.`);
    }
  }
}

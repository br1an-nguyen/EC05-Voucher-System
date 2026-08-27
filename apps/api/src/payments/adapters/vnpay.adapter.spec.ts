import * as crypto from 'crypto';
import { PaymentTransaction } from '@prisma/client';
import { VnPayAdapter } from './vnpay.adapter';
import { VnPayConfigService } from '../vnpay.config';

describe('VnPayAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VNP_TMN_CODE: 'TESTCODE',
      VNP_HASH_SECRET: 'test-hash-secret',
      VNP_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNP_RETURN_URL: 'http://localhost:3000/payments/return/vnpay',
      VNP_IPN_URL: 'https://example.test/payments/vnpay/ipn',
      VNP_VERSION: '2.1.0',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function adapter() {
    return new VnPayAdapter(new VnPayConfigService());
  }

  function payment(): PaymentTransaction {
    return {
      paymentId: '11111111-1111-4111-8111-111111111111',
      orderId: '22222222-2222-4222-8222-222222222222',
      provider: 'VNPAY',
      attemptNo: 1,
      status: 'CREATED',
      idempotencyKey: 'idem-1',
      providerOrderId: null,
      providerTransactionId: null,
      baseAmount: {
        toString: () => '150000',
      } as PaymentTransaction['baseAmount'],
      requestAmountMinor: 150_000n,
      requestCurrency: 'VND',
      settledAmountMinor: null,
      settledCurrency: null,
      exchangeRate: null,
      failureCode: null,
      failureMessage: null,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('creates a signed Sandbox payment URL from the persisted amount', async () => {
    const result = await adapter().createPayment(
      payment(),
      'ORD-TEST',
      '::ffff:10.0.0.8',
    );
    const url = new URL(result.paymentUrl);

    expect(url.hostname).toBe('sandbox.vnpayment.vn');
    expect(url.searchParams.get('vnp_Amount')).toBe('15000000');
    expect(url.searchParams.get('vnp_TxnRef')).toBe(payment().paymentId);
    expect(url.searchParams.get('vnp_IpAddr')).toBe('10.0.0.8');
    expect(url.searchParams.get('vnp_SecureHash')).toMatch(/^[a-f0-9]{128}$/);
  });

  it('accepts a valid signature and rejects a modified signature', async () => {
    const query: Record<string, string> = {
      vnp_Amount: '15000000',
      vnp_CurrCode: 'VND',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14123456',
      vnp_TxnRef: payment().paymentId,
    };
    const payload = Object.keys(query)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(query[key]).replace(/%20/g, '+')}`,
      )
      .join('&');
    query.vnp_SecureHash = crypto
      .createHmac('sha512', process.env.VNP_HASH_SECRET!)
      .update(payload)
      .digest('hex');

    await expect(adapter().verifyAndParseNotification(query)).resolves.toEqual(
      expect.objectContaining({
        signatureValid: true,
        status: 'SUCCESS',
        amountMinor: 15_000_000n,
      }),
    );

    query.vnp_Amount = '15000100';
    await expect(adapter().verifyAndParseNotification(query)).resolves.toEqual(
      expect.objectContaining({ signatureValid: false, status: 'FAILED' }),
    );
  });

  it('reports a clear configuration error instead of using a fallback secret', () => {
    delete process.env.VNP_HASH_SECRET;

    expect(() => adapter().createPayment(payment(), 'ORD-TEST')).toThrow(
      'VNP_HASH_SECRET is required when using VNPAY.',
    );
  });
});

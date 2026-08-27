import {
  PaymentProviderType,
  PaymentTransactionStatus,
  UserRole,
} from '@prisma/client';
import { PaymentsController } from './payments.controller';

describe('PaymentsController VNPAY boundaries', () => {
  const paymentId = '11111111-1111-4111-8111-111111111111';
  const orderId = '22222222-2222-4222-8222-222222222222';

  function harness() {
    const payment = {
      paymentId,
      orderId,
      provider: PaymentProviderType.VNPAY,
      providerOrderId: paymentId,
      requestAmountMinor: 150_000n,
      requestCurrency: 'VND',
      status: PaymentTransactionStatus.PENDING,
      order: { customerId: 'customer-1' },
    };
    const payments = {
      getPaymentDetails: jest.fn().mockResolvedValue(payment),
      getPaymentDetailsForActor: jest.fn().mockResolvedValue(payment),
      markVnPayFailed: jest.fn().mockResolvedValue(undefined),
    };
    const finalization = {
      finalizePayment: jest.fn().mockResolvedValue({ orderId }),
    };
    const vnpay = {
      verifyAndParseNotification: jest.fn().mockResolvedValue({
        signatureValid: true,
        status: 'SUCCESS',
        responseCode: '00',
        transactionStatus: '00',
        transactionReference: paymentId,
        providerTransactionId: '14123456',
        amountMinor: 15_000_000n,
        currency: 'VND',
      }),
    };
    const controller = new PaymentsController(
      payments as never,
      finalization as never,
      vnpay as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { controller, finalization, payment, payments, vnpay };
  }

  it('finalizes a valid successful IPN', async () => {
    const { controller, finalization } = harness();

    await expect(
      controller.handleVnPayIpn({ query: {} } as never),
    ).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(finalization.finalizePayment).toHaveBeenCalledWith(
      paymentId,
      '14123456',
    );
  });

  it('rejects an invalid signature before looking up the payment', async () => {
    const { controller, finalization, payments, vnpay } = harness();
    vnpay.verifyAndParseNotification.mockResolvedValue({
      signatureValid: false,
    });

    await expect(
      controller.handleVnPayIpn({ query: {} } as never),
    ).resolves.toEqual({
      RspCode: '97',
      Message: 'Invalid signature',
    });
    expect(payments.getPaymentDetails).not.toHaveBeenCalled();
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });

  it('rejects an amount mismatch without issuing vouchers', async () => {
    const { controller, finalization, vnpay } = harness();
    vnpay.verifyAndParseNotification.mockResolvedValue({
      signatureValid: true,
      transactionReference: paymentId,
      amountMinor: 14_000_000n,
      currency: 'VND',
    });

    await expect(
      controller.handleVnPayIpn({ query: {} } as never),
    ).resolves.toEqual({
      RspCode: '04',
      Message: 'Invalid amount',
    });
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });

  it('returns order-not-found for an unknown transaction reference', async () => {
    const { controller, payments } = harness();
    payments.getPaymentDetails.mockRejectedValue(new Error('not found'));

    await expect(
      controller.handleVnPayIpn({ query: {} } as never),
    ).resolves.toEqual({
      RspCode: '01',
      Message: 'Order not found',
    });
  });

  it('records a cancelled payment without finalizing it', async () => {
    const { controller, finalization, payments, vnpay } = harness();
    vnpay.verifyAndParseNotification.mockResolvedValue({
      signatureValid: true,
      status: 'FAILED',
      responseCode: '24',
      transactionStatus: '02',
      transactionReference: paymentId,
      providerTransactionId: '',
      amountMinor: 15_000_000n,
      currency: 'VND',
    });

    await controller.handleVnPayIpn({ query: {} } as never);

    expect(payments.markVnPayFailed).toHaveBeenCalledWith(paymentId, '24', '');
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });

  it('acknowledges a duplicate successful IPN without finalizing twice', async () => {
    const { controller, finalization, payment, payments } = harness();
    payments.getPaymentDetails.mockResolvedValue({
      ...payment,
      status: PaymentTransactionStatus.SUCCEEDED,
    });

    await expect(
      controller.handleVnPayIpn({ query: {} } as never),
    ).resolves.toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });

  it('never finalizes payment from the browser Return URL', async () => {
    const { controller, finalization } = harness();

    await expect(
      controller.verifyVnPayReturn({
        query: {},
        user: { userId: 'customer-1', role: UserRole.CUSTOMER },
      } as never),
    ).resolves.toEqual(
      expect.objectContaining({ state: 'PENDING', paymentId, orderId }),
    );
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });
});

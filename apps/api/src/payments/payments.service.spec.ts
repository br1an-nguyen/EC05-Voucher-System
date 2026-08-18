import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService ownership', () => {
  const payment = {
    paymentId: 'payment-1',
    order: { customerId: 'owner-1' },
  };

  it('hides a payment from another customer', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'other-customer',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows an admin to inspect payment status', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }),
    ).resolves.toBe(payment);
  });
});

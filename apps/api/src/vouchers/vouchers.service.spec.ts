import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VouchersService } from './vouchers.service';

describe('VouchersService redemption scope', () => {
  function serviceForCampaign(partnerId: string, branchIds: string[]) {
    const voucher = {
      orderItem: {
        campaign: {
          partnerId,
          campaignBranches: branchIds.map((branchId) => ({ branchId })),
        },
      },
    };
    const prisma = {
      voucherCode: { findUnique: jest.fn().mockResolvedValue(voucher) },
    };
    return new VouchersService(prisma as any, {} as any);
  }

  it('prevents a partner owner from viewing another partner voucher', async () => {
    const service = serviceForCampaign('partner-owner', ['branch-owner']);

    await expect(
      service.verifyVoucherCode(
        { userId: 'partner-other', role: UserRole.PARTNER },
        'SECRET-CODE',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents staff from verifying vouchers outside the assigned branch', async () => {
    const service = serviceForCampaign('partner-owner', ['branch-owner']);

    await expect(
      service.verifyVoucherCode(
        {
          userId: 'staff-1',
          role: UserRole.PARTNER_STAFF,
          partnerId: 'partner-owner',
          branchId: 'branch-other',
        },
        'SECRET-CODE',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('VouchersService public province filters', () => {
  it('filters campaigns by a branch province code', async () => {
    const prisma = {
      voucherCampaign: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new VouchersService(prisma as any, {} as any);

    await service.findPublicCatalog({ provinceCode: '79' });

    expect(prisma.voucherCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignBranches: {
            some: { branch: { is: { provinceCode: '79' } } },
          },
        }),
      }),
    );
  });

  it('counts each active campaign once per province', async () => {
    const prisma = {
      campaignBranch: {
        findMany: jest.fn().mockResolvedValue([
          {
            campaignId: 'campaign-1',
            branch: { provinceCode: '79' },
            campaign: { capacity: 10, soldQuantity: 2 },
          },
          {
            campaignId: 'campaign-1',
            branch: { provinceCode: '79' },
            campaign: { capacity: 10, soldQuantity: 2 },
          },
          {
            campaignId: 'campaign-sold-out',
            branch: { provinceCode: '79' },
            campaign: { capacity: 10, soldQuantity: 10 },
          },
        ]),
      },
    };
    const service = new VouchersService(prisma as any, {} as any);

    await expect(service.findPublicProvinces()).resolves.toEqual([
      { code: '79', name: 'Thành phố Hồ Chí Minh', campaignCount: 1 },
    ]);
  });
});

describe('VouchersService voucher code lock scope', () => {
  const codeId = '11111111-1111-4111-8111-111111111111';

  function createLockService(voucher: any) {
    const tx = {
      voucherCode: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(voucher)
          .mockResolvedValue(voucher),
        findUniqueOrThrow: jest.fn().mockResolvedValue(voucher),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = {
      logAction: jest.fn().mockResolvedValue(undefined),
      logActivity: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new VouchersService(prisma as any, audit as any),
      prisma,
      audit,
    };
  }

  it('prevents a partner from locking another partner voucher code', async () => {
    const { service, prisma } = createLockService({
      codeId,
      status: 'AVAILABLE',
      expiresAt: new Date(Date.now() + 60_000),
      orderItem: { campaign: { partnerId: 'partner-owner' } },
    });

    await expect(
      service.lockVoucherCode(
        { userId: 'partner-other', role: UserRole.PARTNER },
        codeId,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.voucherCode.updateMany).not.toHaveBeenCalled();
  });

  it('allows an admin to lock a voucher regardless of partner ownership', async () => {
    const voucher = {
      codeId,
      status: 'AVAILABLE',
      expiresAt: new Date(Date.now() + 60_000),
      orderItem: { campaign: { partnerId: 'partner-owner' } },
    };
    const { service, prisma } = createLockService(voucher);

    await expect(
      service.lockVoucherCode(
        { userId: 'admin-1', role: UserRole.ADMIN },
        codeId,
      ),
    ).resolves.toEqual(voucher);
    expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
      where: { codeId, status: 'AVAILABLE' },
      data: { status: 'LOCKED' },
    });
  });

  it('expires a locked voucher instead of unlocking it after its deadline', async () => {
    const voucher = {
      codeId,
      status: 'LOCKED',
      expiresAt: new Date(Date.now() - 60_000),
      orderItem: {
        campaign: {
          partnerId: 'partner-owner',
          usageEndTime: new Date(Date.now() + 60_000),
        },
      },
    };
    const { service, prisma } = createLockService(voucher);

    await expect(
      service.unlockVoucherCode(
        { userId: 'partner-owner', role: UserRole.PARTNER },
        codeId,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
      where: { codeId, status: 'LOCKED' },
      data: { status: 'EXPIRED' },
    });
  });

  it('unlocks a voucher without an individual expiry while its campaign is active', async () => {
    const voucher = {
      codeId,
      status: 'LOCKED',
      expiresAt: null,
      orderItem: {
        campaign: {
          partnerId: 'partner-owner',
          usageEndTime: new Date(Date.now() + 60_000),
        },
      },
    };
    const { service, prisma } = createLockService(voucher);

    await expect(
      service.unlockVoucherCode(
        { userId: 'partner-owner', role: UserRole.PARTNER },
        codeId,
      ),
    ).resolves.toEqual(voucher);
    expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
      where: { codeId, status: 'LOCKED' },
      data: { status: 'AVAILABLE' },
    });
  });
});

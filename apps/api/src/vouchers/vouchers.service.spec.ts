import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole, VoucherCodeStatus, VoucherStatus } from '@prisma/client';
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

describe('VouchersService partner campaign management', () => {
  const campaignId = '22222222-2222-4222-8222-222222222222';
  const partnerId = '33333333-3333-4333-8333-333333333333';

  it('derives partner list sold and issued counts from real voucher codes', async () => {
    const prisma = {
      voucherCampaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            campaignId,
            partnerId,
            title: 'Voucher demo',
            soldQuantity: 6,
            campaignBranches: [],
            campaignCategories: [],
            orderItems: [
              {
                quantity: 4,
                unitPrice: 97_000,
                _count: { voucherCodes: 4 },
                voucherCodes: [
                  { status: VoucherCodeStatus.USED },
                  { status: VoucherCodeStatus.CANCELLED },
                ],
              },
            ],
          },
        ]),
      },
    };
    const service = new VouchersService(prisma as any, {} as any);

    const [campaign] = await service.getPartnerCampaigns(partnerId);

    expect(campaign.soldQuantity).toBe(3);
    expect(campaign.issuedCodeCount).toBe(4);
    expect(campaign.usedCount).toBe(1);
  });

  it('uses the same real-code calculation for partner campaign detail', async () => {
    const prisma = {
      voucherCampaign: {
        findFirst: jest.fn().mockResolvedValue({
          campaignId,
          partnerId,
          soldQuantity: 6,
          campaignBranches: [],
          campaignCategories: [],
          campaignBrands: [],
        }),
      },
      voucherCode: {
        groupBy: jest.fn().mockResolvedValue([
          { status: VoucherCodeStatus.AVAILABLE, _count: { _all: 1 } },
          { status: VoucherCodeStatus.USED, _count: { _all: 2 } },
          { status: VoucherCodeStatus.CANCELLED, _count: { _all: 1 } },
        ]),
      },
    };
    const service = new VouchersService(prisma as any, {} as any);

    const campaign = await service.getPartnerCampaignDetail(
      partnerId,
      campaignId,
    );

    expect(campaign.soldQuantity).toBe(3);
    expect(campaign.issuedCodeCount).toBe(4);
  });

  it('does not expose campaign detail owned by another partner', async () => {
    const prisma = {
      voucherCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new VouchersService(prisma as any, {} as any);

    await expect(
      service.getPartnerCampaignDetail(partnerId, campaignId),
    ).rejects.toThrow('không có quyền sở hữu');
    expect(prisma.voucherCampaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId, partnerId } }),
    );
  });

  it('returns paginated voucher codes without customer contact details', async () => {
    const issuedAt = new Date();
    const findMany = jest.fn().mockResolvedValue([
      {
        codeId: 'code-1',
        uniqueCode: 'VOUCHER-001',
        status: 'AVAILABLE',
        issuedAt,
        expiresAt: null,
        customer: { fullName: 'Khách hàng A' },
        orderItem: { order: { orderCode: 'ORD-001' } },
        _count: { usageLogs: 0 },
        usageLogs: [],
      },
    ]);
    const prisma = {
      voucherCampaign: {
        findFirst: jest.fn().mockResolvedValue({ campaignId }),
      },
      voucherCode: {
        count: jest.fn().mockResolvedValue(1),
        findMany,
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const service = new VouchersService(prisma as any, {} as any);

    const result = await service.getPartnerVoucherCodes(partnerId, campaignId, {
      keyword: 'ORD',
      status: VoucherCodeStatus.AVAILABLE,
      page: 1,
      limit: 20,
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({ usageCount: 0, lastUsage: null }),
    );
    expect(result.items[0].customer).toEqual({ fullName: 'Khách hàng A' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('allows an owner to pause an approved campaign with an audited transition', async () => {
    const campaign = {
      campaignId,
      partnerId,
      status: 'APPROVED',
      saleEndTime: new Date(Date.now() + 60_000),
      soldQuantity: 1,
      capacity: 10,
    };
    const updated = { ...campaign, status: 'PAUSED' };
    const tx = {
      voucherCampaign: {
        findFirst: jest.fn().mockResolvedValue(campaign),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const audit = { logActivity: jest.fn().mockResolvedValue(undefined) };
    const service = new VouchersService(prisma as any, audit as any);

    await expect(
      service.updatePartnerCampaignStatus(
        partnerId,
        campaignId,
        VoucherStatus.PAUSED,
      ),
    ).resolves.toEqual(updated);
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledWith({
      where: { campaignId, partnerId, status: 'APPROVED' },
      data: { status: 'PAUSED' },
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'PAUSE_CAMPAIGN' }),
      tx,
    );
  });

  it('prevents reactivation after the sale deadline', async () => {
    const tx = {
      voucherCampaign: {
        findFirst: jest.fn().mockResolvedValue({
          campaignId,
          partnerId,
          status: 'PAUSED',
          saleEndTime: new Date(Date.now() - 60_000),
          soldQuantity: 1,
          capacity: 10,
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new VouchersService(prisma as any, {} as any);

    await expect(
      service.updatePartnerCampaignStatus(
        partnerId,
        campaignId,
        VoucherStatus.APPROVED,
      ),
    ).rejects.toThrow('hết thời gian bán');
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
  });

  it('prevents reactivation when the campaign has sold out', async () => {
    const tx = {
      voucherCampaign: {
        findFirst: jest.fn().mockResolvedValue({
          campaignId,
          partnerId,
          status: 'PAUSED',
          saleEndTime: new Date(Date.now() + 60_000),
          soldQuantity: 10,
          capacity: 10,
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new VouchersService(prisma as any, {} as any);

    await expect(
      service.updatePartnerCampaignStatus(
        partnerId,
        campaignId,
        VoucherStatus.APPROVED,
      ),
    ).rejects.toThrow('bán hết số lượng');
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
  });
});

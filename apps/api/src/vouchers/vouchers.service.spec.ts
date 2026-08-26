import { ForbiddenException } from '@nestjs/common';
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

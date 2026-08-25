import { ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
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

describe('VouchersService public catalog pricing', () => {
  const campaign = (overrides: Record<string, unknown>) => ({
    campaignId: 'campaign-default',
    originalPrice: new Prisma.Decimal(100_000),
    salePrice: new Prisma.Decimal(80_000),
    soldQuantity: 0,
    capacity: 10,
    campaignBrands: [],
    campaignCategories: [],
    ...overrides,
  });

  it('filters regular-price vouchers by originalPrice when salePrice is null', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new VouchersService(
      { voucherCampaign: { findMany } } as any,
      {} as any,
    );

    await service.findPublicCatalog({ minPrice: 50_000, maxPrice: 100_000 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                {
                  salePrice: {
                    not: null,
                    gte: 50_000,
                    lte: 100_000,
                  },
                },
                {
                  salePrice: null,
                  originalPrice: { gte: 50_000, lte: 100_000 },
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('sorts discounted and regular-price vouchers by their effective selling price', async () => {
    const findMany = jest.fn().mockResolvedValue([
      campaign({
        campaignId: 'regular',
        originalPrice: new Prisma.Decimal(50_000),
        salePrice: null,
      }),
      campaign({
        campaignId: 'discounted',
        originalPrice: new Prisma.Decimal(100_000),
        salePrice: new Prisma.Decimal(40_000),
      }),
    ]);
    const service = new VouchersService(
      { voucherCampaign: { findMany } } as any,
      {} as any,
    );

    const result = await service.findPublicCatalog({ sortPrice: 'asc' });

    expect(result.map((item) => item.campaignId)).toEqual([
      'discounted',
      'regular',
    ]);
    expect(result.map((item) => item.sellingPrice.toNumber())).toEqual([
      40_000,
      50_000,
    ]);
  });

  it('keeps sold-out vouchers in the public catalog', async () => {
    const findMany = jest.fn().mockResolvedValue([
      campaign({
        campaignId: 'sold-out',
        soldQuantity: 10,
        capacity: 10,
      }),
    ]);
    const service = new VouchersService(
      { voucherCampaign: { findMany } } as any,
      {} as any,
    );

    const result = await service.findPublicCatalog({});

    expect(result.map((item) => item.campaignId)).toEqual(['sold-out']);
  });
});

describe('VouchersService public category totals', () => {
  it('counts uncategorized and sold-out campaigns in the public totals', async () => {
    const prisma = {
      voucherCategory: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'FOOD_DRINK',
            nameVi: 'Ẩm thực & Đồ uống',
            campaignCategories: [
              {
                campaignId: 'categorized',
                campaign: { capacity: 10, soldQuantity: 0 },
              },
              {
                campaignId: 'sold-out',
                campaign: { capacity: 10, soldQuantity: 10 },
              },
            ],
            children: [],
          },
        ]),
      },
      voucherCampaign: {
        findMany: jest.fn().mockResolvedValue([
          { campaignId: 'categorized', capacity: 10, soldQuantity: 0 },
          { campaignId: 'uncategorized', capacity: 10, soldQuantity: 0 },
          { campaignId: 'sold-out', capacity: 10, soldQuantity: 10 },
        ]),
      },
    };
    const service = new VouchersService(prisma as any, {} as any);

    const result = await service.findPublicCategories();

    expect(result.totalCampaignCount).toBe(3);
    expect(result.categories).toEqual([
      expect.objectContaining({
        code: 'FOOD_DRINK',
        campaignCount: 2,
      }),
    ]);
  });
});

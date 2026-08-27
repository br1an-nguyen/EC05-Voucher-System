import { PartnersService } from './partners.service';

describe('PartnersService dashboard', () => {
  it('should return metrics scoped to the current partner account', async () => {
    const prisma = {
      partner: {
        findUnique: jest.fn().mockResolvedValue({ companyName: 'Cửa hàng A' }),
      },
      voucherCampaign: {
        findMany: jest.fn().mockResolvedValue([
          { campaignId: 'c1', status: 'APPROVED', soldQuantity: 12 },
          { campaignId: 'c2', status: 'DRAFT', soldQuantity: 3 },
          { campaignId: 'c3', status: 'APPROVED', soldQuantity: 5 },
        ]),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 2, unitPrice: '150000', order: { customerId: 'u-1' } },
          { quantity: 3, unitPrice: '200000', order: { customerId: 'u-2' } },
          { quantity: 1, unitPrice: '50000', order: { customerId: 'u-1' } },
        ]),
      },
      voucherCode: {
        count: jest.fn().mockResolvedValue(4),
      },
    };

    const service = new PartnersService(prisma as any, {} as any);

    const result = await service.getDashboard('partner-1');

    expect(prisma.partner.findUnique).toHaveBeenCalledWith({
      where: { partnerId: 'partner-1' },
      select: { companyName: true },
    });
    expect(prisma.voucherCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { partnerId: 'partner-1' },
      }),
    );
    expect(result.totalCampaigns).toBe(3);
    expect(result.activeCampaigns).toBe(2);
    expect(result.soldVouchers).toBe(20);
    expect(result.customerCount).toBe(2);
    expect(result.revenue).toBe(950000);
    expect(result.usedVouchers).toBe(4);
    expect(result.partnerName).toBe('Cửa hàng A');
  });

  it('returns every voucher campaign status in the admin dashboard', async () => {
    const voucherCampaignCount = jest
      .fn()
      .mockResolvedValueOnce(65)
      .mockResolvedValueOnce(35)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    const prisma = {
      partner: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([]),
      },
      voucherCampaign: { count: voucherCampaignCount },
      order: {
        count: jest.fn().mockResolvedValue(12),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { totalAmount: 900000 } }),
      },
      user: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(4),
      },
    };
    const service = new PartnersService(prisma as any, {} as any);

    const result = await service.getAdminDashboard();

    expect(result.totalCampaigns).toBe(65);
    expect(result.campaignStats).toEqual({
      approved: 35,
      pending: 6,
      draft: 5,
      rejected: 5,
      expired: 5,
      paused: 4,
      soldOut: 5,
    });
    expect(voucherCampaignCount).toHaveBeenCalledWith({
      where: { status: 'PAUSED' },
    });
    expect(voucherCampaignCount).toHaveBeenCalledWith({
      where: { status: 'SOLD_OUT' },
    });
  });
});

describe('PartnersService branches', () => {
  it('stores the normalized province code when creating a branch', async () => {
    const prisma = {
      branch: { create: jest.fn().mockResolvedValue({ branchId: 'branch-1' }) },
    };
    const service = new PartnersService(prisma as any, {} as any);

    await service.createBranch('partner-1', {
      name: 'Chi nhánh trung tâm',
      address: '123 Lê Lợi',
      provinceCode: '79',
    });

    expect(prisma.branch.create).toHaveBeenCalledWith({
      data: {
        partnerId: 'partner-1',
        name: 'Chi nhánh trung tâm',
        address: '123 Lê Lợi',
        provinceCode: '79',
      },
    });
  });
});

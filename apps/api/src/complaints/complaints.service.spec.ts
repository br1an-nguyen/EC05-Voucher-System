import { BadRequestException } from '@nestjs/common';
import { ComplaintStatus, ComplaintType } from '@prisma/client';
import { ComplaintsService } from './complaints.service';

describe('ComplaintsService complaint integrity', () => {
  const customerId = '00000000-0000-4000-8000-000000000001';
  const complaintId = '00000000-0000-4000-8000-000000000002';
  const adminId = '00000000-0000-4000-8000-000000000003';
  const orderId = '00000000-0000-4000-8000-000000000004';
  const itemId = '00000000-0000-4000-8000-000000000005';
  const campaignId = '00000000-0000-4000-8000-000000000006';
  const partnerId = '00000000-0000-4000-8000-000000000007';
  const voucherCodeId = '00000000-0000-4000-8000-000000000008';

  function createContext() {
    const tx = {
      voucherCode: { findFirst: jest.fn() },
      orderItem: { findFirst: jest.fn() },
      voucherReview: { findFirst: jest.fn() },
      order: { findFirst: jest.fn() },
      complaint: {
        create: jest.fn().mockImplementation(({ data }) => ({
          complaintId,
          status: ComplaintStatus.OPEN,
          ...data,
        })),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ complaintId, ...data })),
      },
      complaintMessage: { create: jest.fn() },
      complaintEvent: { create: jest.fn() },
    };
    let transactionActive = false;
    const prisma = {
      $transaction: jest.fn(async (callback) => {
        transactionActive = true;
        try {
          return await callback(tx);
        } finally {
          transactionActive = false;
        }
      }),
    };
    const audit = {
      logActivity: jest.fn().mockImplementation(async () => {
        expect(transactionActive).toBe(true);
      }),
    };
    const service = new ComplaintsService(prisma as any, audit as any);
    return { service, tx, audit };
  }

  it.each([
    ['order', { orderId }, 'order'],
    ['order item', { orderItemId: itemId }, 'orderItem'],
    ['voucher', { voucherCodeId }, 'voucherCode'],
    [
      'review',
      { reviewId: '00000000-0000-4000-8000-000000000009' },
      'voucherReview',
    ],
    ['campaign', { campaignId }, 'orderItem'],
  ])(
    'rejects a foreign %s reference',
    async (_label, reference, repository) => {
      const { service, tx } = createContext();
      (tx as Record<string, any>)[repository].findFirst.mockResolvedValue(null);

      await expect(
        service.create(customerId, {
          type: ComplaintType.VOUCHER,
          subject: 'Không sử dụng được voucher',
          description: 'Mã voucher báo lỗi.',
          ...reference,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.complaint.create).not.toHaveBeenCalled();
    },
  );

  it('derives the partner and purchase context from an owned voucher', async () => {
    const { service, tx, audit } = createContext();
    tx.voucherCode.findFirst.mockResolvedValue({
      codeId: voucherCodeId,
      itemId,
      orderItem: {
        orderId,
        campaignId,
        campaign: { partnerId },
      },
    });

    await service.create(customerId, {
      type: ComplaintType.VOUCHER,
      subject: '  Không sử dụng được voucher  ',
      description: '  Mã voucher báo lỗi.  ',
      voucherCodeId,
    });

    expect(tx.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId,
        voucherCodeId,
        orderItemId: itemId,
        orderId,
        campaignId,
        partnerId,
        subject: 'Không sử dụng được voucher',
        description: 'Mã voucher báo lỗi.',
      }),
    });
    expect(tx.complaintMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId,
        senderId: customerId,
        body: 'Mã voucher báo lỗi.',
      }),
    });
    expect(tx.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId,
        eventType: 'SUBMITTED',
        toStatus: ComplaintStatus.OPEN,
      }),
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: complaintId,
        actionType: 'CREATE_COMPLAINT',
      }),
      tx,
    );
  });

  it('rejects references that point to different purchases', async () => {
    const { service, tx } = createContext();
    tx.voucherCode.findFirst.mockResolvedValue({
      codeId: voucherCodeId,
      itemId,
      orderItem: { orderId, campaignId, campaign: { partnerId } },
    });
    tx.order.findFirst.mockResolvedValue({
      orderId: '00000000-0000-4000-8000-000000000099',
      orderItems: [],
    });

    await expect(
      service.create(customerId, {
        type: ComplaintType.VOUCHER,
        subject: 'Voucher lỗi',
        description: 'Không dùng được.',
        voucherCodeId,
        orderId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.complaint.create).not.toHaveBeenCalled();
  });

  it('keeps resolved fields empty for an in-progress admin response', async () => {
    const { service, tx, audit } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.OPEN,
    });

    await service.replyComplaint(complaintId, adminId, {
      status: ComplaintStatus.WAITING_PARTNER,
      resolutionResponse: 'Đang chờ đối tác xác minh.',
    });

    expect(tx.complaint.update).toHaveBeenCalledWith({
      where: { complaintId },
      data: expect.objectContaining({
        status: ComplaintStatus.WAITING_PARTNER,
        assignedAdminId: adminId,
        resolvedById: null,
        resolvedAt: null,
        closedAt: null,
      }),
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ADMIN_REPLY_COMPLAINT' }),
      tx,
    );
  });

  it('sets resolution fields and records timeline data for a terminal response', async () => {
    const { service, tx } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.IN_REVIEW,
    });

    await service.replyComplaint(complaintId, adminId, {
      status: ComplaintStatus.RESOLVED,
      resolutionResponse: 'Đã hoàn tất xử lý.',
    });

    expect(tx.complaint.update).toHaveBeenCalledWith({
      where: { complaintId },
      data: expect.objectContaining({
        status: ComplaintStatus.RESOLVED,
        resolvedById: adminId,
        resolvedAt: expect.any(Date),
      }),
    });
    expect(tx.complaintMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderId: adminId,
        body: 'Đã hoàn tất xử lý.',
      }),
    });
    expect(tx.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: ComplaintStatus.IN_REVIEW,
        toStatus: ComplaintStatus.RESOLVED,
      }),
    });
  });
});

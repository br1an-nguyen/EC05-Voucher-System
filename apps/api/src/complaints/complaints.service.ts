import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  ComplaintMessageVisibility,
  ComplaintStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';

type ComplaintContext = {
  orderId?: string;
  orderItemId?: string;
  voucherCodeId?: string;
  campaignId?: string;
  reviewId?: string;
  partnerId?: string;
};

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mergeContext(
    context: ComplaintContext,
    values: ComplaintContext,
    sourceLabel: string,
  ) {
    for (const [key, value] of Object.entries(values)) {
      if (!value) continue;
      const field = key as keyof ComplaintContext;
      if (context[field] && context[field] !== value) {
        throw new BadRequestException(
          `${sourceLabel} không khớp với các tham chiếu khác trong khiếu nại.`,
        );
      }
      context[field] = value;
    }
  }

  private async resolveComplaintContext(
    tx: Prisma.TransactionClient,
    customerId: string,
    dto: CreateComplaintDto,
  ): Promise<ComplaintContext> {
    const context: ComplaintContext = {};

    if (dto.voucherCodeId) {
      const voucher = await tx.voucherCode.findFirst({
        where: { codeId: dto.voucherCodeId, customerId },
        select: {
          codeId: true,
          itemId: true,
          orderItem: {
            select: {
              orderId: true,
              campaignId: true,
              campaign: { select: { partnerId: true } },
            },
          },
        },
      });
      if (!voucher) {
        throw new BadRequestException(
          'Voucher không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          voucherCodeId: voucher.codeId,
          orderItemId: voucher.itemId,
          orderId: voucher.orderItem.orderId,
          campaignId: voucher.orderItem.campaignId,
          partnerId: voucher.orderItem.campaign.partnerId,
        },
        'Voucher',
      );
    }

    if (dto.orderItemId) {
      const item = await tx.orderItem.findFirst({
        where: { itemId: dto.orderItemId, order: { customerId } },
        select: {
          itemId: true,
          orderId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
      });
      if (!item) {
        throw new BadRequestException(
          'Sản phẩm trong đơn không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          orderItemId: item.itemId,
          orderId: item.orderId,
          campaignId: item.campaignId,
          partnerId: item.campaign.partnerId,
        },
        'Sản phẩm trong đơn',
      );
    }

    if (dto.reviewId) {
      const review = await tx.voucherReview.findFirst({
        where: { reviewId: dto.reviewId, customerId },
        select: {
          reviewId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
      });
      if (!review) {
        throw new BadRequestException(
          'Đánh giá không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          reviewId: review.reviewId,
          campaignId: review.campaignId,
          partnerId: review.campaign.partnerId,
        },
        'Đánh giá',
      );
    }

    if (dto.orderId) {
      const order = await tx.order.findFirst({
        where: { orderId: dto.orderId, customerId },
        select: {
          orderId: true,
          orderItems: {
            select: {
              itemId: true,
              campaignId: true,
              campaign: { select: { partnerId: true } },
            },
          },
        },
      });
      if (!order) {
        throw new BadRequestException(
          'Đơn hàng không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(context, { orderId: order.orderId }, 'Đơn hàng');

      if (context.campaignId) {
        const matchingItem = order.orderItems.find(
          (item) => item.campaignId === context.campaignId,
        );
        if (!matchingItem) {
          throw new BadRequestException(
            'Chiến dịch không thuộc đơn hàng đã chọn.',
          );
        }
        this.mergeContext(
          context,
          {
            orderItemId: matchingItem.itemId,
            campaignId: matchingItem.campaignId,
            partnerId: matchingItem.campaign.partnerId,
          },
          'Đơn hàng',
        );
      }
    }

    if (dto.campaignId) {
      const purchasedItem = await tx.orderItem.findFirst({
        where: {
          campaignId: dto.campaignId,
          order: {
            customerId,
            ...(context.orderId ? { orderId: context.orderId } : {}),
          },
        },
        select: {
          itemId: true,
          orderId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
        orderBy: { order: { createdAt: 'desc' } },
      });
      if (!purchasedItem) {
        throw new BadRequestException(
          'Chiến dịch không thuộc lịch sử mua hàng của khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          campaignId: purchasedItem.campaignId,
          partnerId: purchasedItem.campaign.partnerId,
          ...(context.orderId
            ? {
                orderId: purchasedItem.orderId,
                orderItemId: purchasedItem.itemId,
              }
            : {}),
        },
        'Chiến dịch',
      );
    }

    return context;
  }

  async create(customerId: string, createDto: CreateComplaintDto) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.resolveComplaintContext(
        tx,
        customerId,
        createDto,
      );
      const complaint = await tx.complaint.create({
        data: {
          customerId,
          type: createDto.type,
          subject: createDto.subject.trim(),
          description: createDto.description.trim(),
          ...context,
        },
      });

      await tx.complaintMessage.create({
        data: {
          complaintId: complaint.complaintId,
          senderId: customerId,
          senderRoleSnapshot: UserRole.CUSTOMER,
          visibility: ComplaintMessageVisibility.ALL_PARTIES,
          body: complaint.description,
        },
      });
      await tx.complaintEvent.create({
        data: {
          complaintId: complaint.complaintId,
          actorId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          eventType: 'SUBMITTED',
          toStatus: ComplaintStatus.OPEN,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          category: ActivityCategory.SUPPORT,
          actionType: 'CREATE_COMPLAINT',
          targetEntity: 'Complaint',
          targetId: complaint.complaintId,
          metadata: {
            type: complaint.type,
            partnerId: complaint.partnerId ?? null,
          },
        },
        tx,
      );

      return complaint;
    });
  }

  async findCustomerComplaints(customerId: string) {
    return this.prisma.complaint.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { title: true } },
        order: { select: { orderCode: true } },
        partner: { select: { companyName: true } },
      },
    });
  }

  async findCustomerComplaintDetail(customerId: string, complaintId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { complaintId, customerId },
      include: {
        campaign: {
          select: { title: true, partner: { select: { companyName: true } } },
        },
        order: { select: { orderCode: true } },
        partner: { select: { companyName: true } },
        messages: {
          where: { visibility: ComplaintMessageVisibility.ALL_PARTIES },
          orderBy: { createdAt: 'asc' },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Không tìm thấy khiếu nại này.');
    }
    return complaint;
  }

  async findAllAdmin() {
    return this.prisma.complaint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { email: true, fullName: true, phone: true } },
        campaign: { select: { title: true } },
        partner: { select: { companyName: true } },
        assignedAdmin: { select: { email: true, fullName: true } },
      },
    });
  }

  async findOneAdmin(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
      include: {
        customer: { select: { email: true, fullName: true, phone: true } },
        resolvedBy: { select: { email: true, fullName: true } },
        assignedAdmin: { select: { email: true, fullName: true } },
        partner: { select: { companyName: true } },
        campaign: {
          select: { title: true, partner: { select: { companyName: true } } },
        },
        order: { select: { orderCode: true, totalAmount: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }
    return complaint;
  }

  async replyComplaint(
    complaintId: string,
    adminId: string,
    replyDto: ReplyComplaintDto,
  ) {
    const allowedStatuses: ComplaintStatus[] = [
      ComplaintStatus.IN_REVIEW,
      ComplaintStatus.WAITING_PARTNER,
      ComplaintStatus.WAITING_CUSTOMER,
      ComplaintStatus.RESOLVED,
      ComplaintStatus.REJECTED,
      ComplaintStatus.CLOSED,
    ];
    if (!allowedStatuses.includes(replyDto.status)) {
      throw new BadRequestException('Trạng thái phản hồi không hợp lệ.');
    }

    return this.prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findUnique({
        where: { complaintId },
      });
      if (!complaint) {
        throw new NotFoundException('Complaint not found');
      }
      if (complaint.status === ComplaintStatus.CLOSED) {
        throw new BadRequestException(
          'Khiếu nại đã đóng và không thể phản hồi thêm.',
        );
      }

      const now = new Date();
      const terminalStatuses: ComplaintStatus[] = [
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
        ComplaintStatus.CLOSED,
      ];
      const terminal = terminalStatuses.includes(replyDto.status);
      const updated = await tx.complaint.update({
        where: { complaintId },
        data: {
          status: replyDto.status,
          resolutionResponse: replyDto.resolutionResponse.trim(),
          assignedAdminId: adminId,
          resolvedById: terminal ? adminId : null,
          resolvedAt: terminal ? now : null,
          closedAt: replyDto.status === ComplaintStatus.CLOSED ? now : null,
          version: { increment: 1 },
        },
      });

      await tx.complaintMessage.create({
        data: {
          complaintId,
          senderId: adminId,
          senderRoleSnapshot: UserRole.ADMIN,
          visibility: ComplaintMessageVisibility.ALL_PARTIES,
          body: replyDto.resolutionResponse.trim(),
        },
      });
      await tx.complaintEvent.create({
        data: {
          complaintId,
          actorId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          eventType: 'ADMIN_REPLY',
          fromStatus: complaint.status,
          toStatus: replyDto.status,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.SUPPORT,
          actionType: 'ADMIN_REPLY_COMPLAINT',
          targetEntity: 'Complaint',
          targetId: complaintId,
          metadata: { fromStatus: complaint.status, toStatus: replyDto.status },
        },
        tx,
      );

      return updated;
    });
  }
}

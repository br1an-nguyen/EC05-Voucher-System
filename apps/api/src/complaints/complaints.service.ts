import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, createDto: CreateComplaintDto) {
    return this.prisma.complaint.create({
      data: {
        ...createDto,
        customerId,
      },
    });
  }

  async findCustomerComplaints(customerId: string) {
    return this.prisma.complaint.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: {
          select: { title: true },
        },
        order: {
          select: { orderCode: true },
        },
      },
    });
  }

  async findCustomerComplaintDetail(customerId: string, complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
      include: {
        campaign: { select: { title: true, partner: { select: { companyName: true } } } },
        order: { select: { orderCode: true } },
      },
    });

    if (!complaint || complaint.customerId !== customerId) {
      throw new NotFoundException('Không tìm thấy khiếu nại này.');
    }

    return complaint;
  }

  // --- ADMIN METHODS ---

  async findAllAdmin() {
    return this.prisma.complaint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { email: true, fullName: true, phone: true } },
        campaign: { select: { title: true } },
      },
    });
  }

  async findOneAdmin(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
      include: {
        customer: { select: { email: true, fullName: true, phone: true } },
        resolvedBy: { select: { email: true, fullName: true } },
        campaign: { select: { title: true, partner: { select: { companyName: true } } } },
        order: { select: { orderCode: true, totalAmount: true } },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }
    return complaint;
  }

  async replyComplaint(complaintId: string, adminId: string, replyDto: ReplyComplaintDto) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return this.prisma.complaint.update({
      where: { complaintId },
      data: {
        status: replyDto.status,
        resolutionResponse: replyDto.resolutionResponse,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });
  }
}

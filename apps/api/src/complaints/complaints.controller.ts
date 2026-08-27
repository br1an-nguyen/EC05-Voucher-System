import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // --- CUSTOMER ---
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  create(@Req() req: any, @Body() createDto: CreateComplaintDto) {
    return this.complaintsService.create(req.user.userId, createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  findMyComplaints(@Req() req: any) {
    return this.complaintsService.findCustomerComplaints(req.user.userId);
  }

  // --- ADMIN ---
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllAdmin() {
    return this.complaintsService.findAllAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOneAdmin(@Param('id') id: string) {
    return this.complaintsService.findOneAdmin(id);
  }

  @Patch('admin/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  replyComplaint(@Param('id') id: string, @Req() req: any, @Body() replyDto: ReplyComplaintDto) {
    return this.complaintsService.replyComplaint(id, req.user.userId, replyDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  findMyComplaintDetail(@Req() req: any, @Param('id') id: string) {
    return this.complaintsService.findCustomerComplaintDetail(req.user.userId, id);
  }

}

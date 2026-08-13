import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Controller tiếp nhận REST API cho các tác vụ liên quan đến Đối tác và Chi nhánh.
 * Tất cả các endpoints đều yêu cầu xác thực JWT.
 */
@Controller('partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnersController {
  constructor(private partnersService: PartnersService) {}

  /**
   * Lấy thông tin hồ sơ của đối tác hiện tại đang đăng nhập.
   * GET /partners/profile
   */
  @Get('profile')
  @Roles(UserRole.PARTNER)
  async getProfile(@Req() req: any) {
    return this.partnersService.getProfile(req.user.userId);
  }

  /**
   * Cập nhật thông tin hồ sơ đối tác.
   * PATCH /partners/profile
   */
  @Patch('profile')
  @Roles(UserRole.PARTNER)
  async updateProfile(@Req() req: any, @Body() updatePartnerDto: UpdatePartnerDto) {
    return this.partnersService.updateProfile(req.user.userId, updatePartnerDto);
  }

  /**
   * Lấy danh sách chi nhánh của đối tác hiện tại.
   * GET /partners/branches
   */
  @Get('branches')
  @Roles(UserRole.PARTNER)
  async getBranches(@Req() req: any) {
    return this.partnersService.getBranches(req.user.userId);
  }

  /**
   * Tạo chi nhánh mới.
   * POST /partners/branches
   */
  @Post('branches')
  @Roles(UserRole.PARTNER)
  async createBranch(@Req() req: any, @Body() createBranchDto: CreateBranchDto) {
    return this.partnersService.createBranch(req.user.userId, createBranchDto);
  }

  /**
   * Cập nhật chi nhánh.
   * PATCH /partners/branches/:id
   */
  @Patch('branches/:id')
  @Roles(UserRole.PARTNER)
  async updateBranch(
    @Req() req: any,
    @Param('id') branchId: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.partnersService.updateBranch(req.user.userId, branchId, updateBranchDto);
  }

  /**
   * Xóa chi nhánh.
   * DELETE /partners/branches/:id
   */
  @Delete('branches/:id')
  @Roles(UserRole.PARTNER)
  async deleteBranch(@Req() req: any, @Param('id') branchId: string) {
    return this.partnersService.deleteBranch(req.user.userId, branchId);
  }

  // ================= ADMIN ENDPOINTS =================

  /**
   * Admin: Xem danh sách đối tác chờ duyệt hoặc đã duyệt.
   * GET /partners/admin/list
   */
  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminListPartners() {
    return this.partnersService.adminListPartners();
  }

  /**
   * Admin: Phê duyệt đối tác.
   * PATCH /partners/admin/:id/approve
   */
  @Patch('admin/:id/approve')
  @Roles(UserRole.ADMIN)
  async adminApprovePartner(@Req() req: any, @Param('id') partnerId: string) {
    return this.partnersService.adminApprovePartner(req.user.userId, partnerId);
  }

  /**
   * Admin: Từ chối phê duyệt đối tác.
   * PATCH /partners/admin/:id/reject
   */
  @Patch('admin/:id/reject')
  @Roles(UserRole.ADMIN)
  async adminRejectPartner(@Req() req: any, @Param('id') partnerId: string) {
    return this.partnersService.adminRejectPartner(req.user.userId, partnerId);
  }
}

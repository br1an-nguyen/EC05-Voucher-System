import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Controller tiếp nhận REST API phục vụ việc khởi tạo, chỉnh sửa và phê duyệt các chiến dịch voucher.
 */
@Controller('vouchers')
export class VouchersController {
  constructor(private vouchersService: VouchersService) {}

  /**
   * Lấy danh sách voucher công khai để hiển thị cho khách hàng (trang chủ).
   * GET /vouchers
   */
  @Get()
  async findPublicCatalog(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.vouchersService.findPublicCatalog({
      keyword,
      category,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      branchId,
    });
  }

  /**
   * Tạo chiến dịch voucher mới ở dạng nháp.
   * POST /vouchers
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async create(@Req() req: any, @Body() createCampaignDto: CreateCampaignDto) {
    return this.vouchersService.create(req.user.userId, createCampaignDto);
  }

  /**
   * Cập nhật thông tin chiến dịch voucher (chỉ áp dụng cho DRAFT/REJECTED).
   * PATCH /vouchers/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async update(
    @Req() req: any,
    @Param('id') campaignId: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.vouchersService.update(req.user.userId, campaignId, updateCampaignDto);
  }

  /**
   * Gửi chiến dịch lên để chờ xét duyệt.
   * POST /vouchers/:id/submit
   */
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async submitForApproval(@Req() req: any, @Param('id') campaignId: string) {
    return this.vouchersService.submitForApproval(req.user.userId, campaignId);
  }

  /**
   * Lấy danh sách voucher thuộc quyền sở hữu của đối tác đăng nhập.
   * GET /vouchers/partner/list
   */
  @Get('partner/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async getPartnerCampaigns(@Req() req: any) {
    return this.vouchersService.getPartnerCampaigns(req.user.userId);
  }

  /**
   * Chi tiết chiến dịch voucher (Có thể truy cập công khai).
   * GET /vouchers/:id
   */
  @Get(':id')
  async findOne(@Param('id') campaignId: string) {
    return this.vouchersService.findOne(campaignId);
  }


  // ================= ADMIN ENDPOINTS =================

  /**
   * Admin: Xem danh sách các voucher đang chờ duyệt.
   * GET /vouchers/admin/pending
   */
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminListPendingCampaigns() {
    return this.vouchersService.adminListPendingCampaigns();
  }

  /**
   * Admin: Phê duyệt duyệt đăng voucher.
   * PATCH /vouchers/admin/:id/approve
   */
  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminApproveCampaign(@Param('id') campaignId: string) {
    return this.vouchersService.adminApproveCampaign(campaignId);
  }

  /**
   * Admin: Từ chối đăng voucher.
   * PATCH /vouchers/admin/:id/reject
   */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminRejectCampaign(@Param('id') campaignId: string) {
    return this.vouchersService.adminRejectCampaign(campaignId);
  }
}

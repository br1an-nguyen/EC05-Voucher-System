import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';

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
  async findPublicCatalog(@Query() query: PublicCatalogQueryDto) {
    return this.vouchersService.findPublicCatalog(query);
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
   * Xem trước thông tin chi tiết mã voucher trước khi đổi.
   * GET /vouchers/redeem/verify/:code
   */
  @Get('redeem/verify/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER, UserRole.PARTNER_STAFF, UserRole.ADMIN)
  async verifyVoucherCode(@Req() req: any, @Param('code') uniqueCode: string) {
    return this.vouchersService.verifyVoucherCode(req.user, uniqueCode);
  }

  /**
   * Quét và đổi mã voucher tại một chi nhánh cụ thể.
   * POST /vouchers/redeem
   */
  @Post('redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER, UserRole.PARTNER_STAFF, UserRole.ADMIN)
  async redeemVoucher(
    @Req() req: any,
    @Body() dto: RedeemVoucherDto,
  ) {
    return this.vouchersService.redeemVoucher(
      req.user,
      dto.uniqueCode,
      dto.branchId,
    );
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
   * Lấy danh sách ví voucher cá nhân của khách hàng.
   * GET /vouchers/customer/wallet
   */
  @Get('customer/wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async getCustomerWallet(@Req() req: any) {
    return this.vouchersService.getCustomerWallet(req.user.userId);
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
  async adminApproveCampaign(@Req() req: any, @Param('id') campaignId: string) {
    return this.vouchersService.adminApproveCampaign(req.user.userId, campaignId);
  }

  /**
   * Admin: Từ chối đăng voucher.
   * PATCH /vouchers/admin/:id/reject
   */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminRejectCampaign(@Req() req: any, @Param('id') campaignId: string) {
    return this.vouchersService.adminRejectCampaign(req.user.userId, campaignId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, VoucherStatus } from '@prisma/client';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import {
  AdminCategoryQueryDto,
  CreateAdminCategoryDto,
  UpdateAdminCategoryDto,
} from './dto/admin-category.dto';
import { PartnerVoucherCodesQueryDto } from './dto/partner-voucher-codes-query.dto';
import { UpdatePartnerCampaignStatusDto } from './dto/update-partner-campaign-status.dto';

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
   * Danh mục chuẩn hóa có số lượng voucher đang mở bán.
   * GET /vouchers/categories
   */
  @Get('categories')
  async findPublicCategories() {
    return this.vouchersService.findPublicCategories();
  }

  /**
   * Tỉnh/thành có voucher đang mở bán, dùng cho bộ lọc catalog.
   * GET /vouchers/provinces
   */
  @Get('provinces')
  async findPublicProvinces() {
    return this.vouchersService.findPublicProvinces();
  }

  /**
   * Danh sách đối tác có voucher đang mở bán, dùng cho bộ lọc catalog.
   * GET /vouchers/partners
   */
  @Get('partners')
  async findPublicPartners() {
    return this.vouchersService.findPublicPartners();
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
  async redeemVoucher(@Req() req: any, @Body() dto: RedeemVoucherDto) {
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
    return this.vouchersService.update(
      req.user.userId,
      campaignId,
      updateCampaignDto,
    );
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
   * Lấy chi tiết một chiến dịch thuộc quyền sở hữu của đối tác đăng nhập.
   * GET /vouchers/partner/:id
   */
  @Get('partner/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async getPartnerCampaignDetail(
    @Req() req: any,
    @Param('id') campaignId: string,
  ) {
    return this.vouchersService.getPartnerCampaignDetail(
      req.user.userId,
      campaignId,
    );
  }

  /**
   * Lấy danh sách từng voucher code đã phát hành của một chiến dịch.
   * GET /vouchers/partner/:id/codes
   */
  @Get('partner/:id/codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async getPartnerVoucherCodes(
    @Req() req: any,
    @Param('id') campaignId: string,
    @Query() query: PartnerVoucherCodesQueryDto,
  ) {
    return this.vouchersService.getPartnerVoucherCodes(
      req.user.userId,
      campaignId,
      query,
    );
  }

  /**
   * Đối tác ngừng bán hoặc mở bán lại chiến dịch của mình.
   * PATCH /vouchers/partner/:id/status
   */
  @Patch('partner/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTNER)
  async updatePartnerCampaignStatus(
    @Req() req: any,
    @Param('id') campaignId: string,
    @Body() dto: UpdatePartnerCampaignStatusDto,
  ) {
    return this.vouchersService.updatePartnerCampaignStatus(
      req.user.userId,
      campaignId,
      dto.status,
    );
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
    return this.vouchersService.adminApproveCampaign(
      req.user.userId,
      campaignId,
    );
  }

  /**
   * Admin: Từ chối đăng voucher.
   * PATCH /vouchers/admin/:id/reject
   */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminRejectCampaign(@Req() req: any, @Param('id') campaignId: string) {
    return this.vouchersService.adminRejectCampaign(
      req.user.userId,
      campaignId,
    );
  }

  /**
   * Admin: Lấy danh sách toàn bộ danh mục dạng phẳng.
   * GET /vouchers/admin/categories
   */
  @Get('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminListCategories(@Query() query: AdminCategoryQueryDto) {
    return this.vouchersService.adminListCategories(query);
  }

  /**
   * Admin: Tạo danh mục voucher mới.
   * POST /vouchers/admin/categories
   */
  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminCreateCategory(
    @Req() req: any,
    @Body() dto: CreateAdminCategoryDto,
  ) {
    return this.vouchersService.adminCreateCategory(req.user.userId, dto);
  }

  /**
   * Admin: Cập nhật danh mục voucher.
   * PATCH /vouchers/admin/categories/:id
   */
  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUpdateCategory(
    @Req() req: any,
    @Param('id') categoryId: string,
    @Body() dto: UpdateAdminCategoryDto,
  ) {
    return this.vouchersService.adminUpdateCategory(
      req.user.userId,
      categoryId,
      dto,
    );
  }

  /**
   * Admin: Lưu trữ (ngừng hoạt động) danh mục voucher.
   * DELETE /vouchers/admin/categories/:id (giữ route để tương thích client cũ)
   */
  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminDeleteCategory(@Req() req: any, @Param('id') categoryId: string) {
    return this.vouchersService.adminDeleteCategory(
      req.user.userId,
      categoryId,
    );
  }

  /**
   * Admin: Xem danh sách toàn bộ chiến dịch voucher trên sàn.
   * GET /vouchers/admin/list
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminListCampaigns(
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.vouchersService.adminListCampaigns({ keyword, status });
  }

  /**
   * Admin: Cập nhật trạng thái vòng đời chiến dịch voucher.
   * PATCH /vouchers/admin/:id/status
   */
  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUpdateCampaignStatus(
    @Req() req: any,
    @Param('id') campaignId: string,
    @Body('status') status: VoucherStatus,
  ) {
    return this.vouchersService.adminUpdateCampaignStatus(
      req.user.userId,
      campaignId,
      status,
    );
  }

  /**
   * Admin/Partner: Khóa mã voucher ngưng cho phép đổi mã.
   * PATCH /vouchers/codes/:codeId/lock
   */
  @Patch('codes/:codeId/lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  async lockVoucherCode(@Req() req: any, @Param('codeId') codeId: string) {
    return this.vouchersService.lockVoucherCode(req.user, codeId);
  }

  /**
   * Admin/Partner: Mở khóa mã voucher.
   * PATCH /vouchers/codes/:codeId/unlock
   */
  @Patch('codes/:codeId/unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  async unlockVoucherCode(@Req() req: any, @Param('codeId') codeId: string) {
    return this.vouchersService.unlockVoucherCode(req.user, codeId);
  }
}

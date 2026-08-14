import { Controller, Patch, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * Controller tiếp nhận các tác vụ tự chỉnh sửa thông tin cá nhân của người dùng hiện tại.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Cập nhật thông tin cá nhân (đổi họ tên, sđt hoặc đổi mật khẩu).
   * PATCH /users/profile
   */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: any) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  /**
   * Khách hàng tự yêu cầu xóa vĩnh viễn tài khoản.
   * DELETE /users/profile
   */
  @Delete('profile')
  async deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.userId);
  }
}

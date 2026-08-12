import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Module quản lý tài khoản người dùng.
 * Cung cấp UsersService cho các phân hệ khác (như AuthModule) sử dụng.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

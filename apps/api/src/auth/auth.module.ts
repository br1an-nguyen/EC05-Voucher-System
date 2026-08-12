import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Module quản lý toàn bộ các cấu hình xác thực JWT, Passport và kết nối UsersModule.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      // Secret key ký token
      secret: process.env.JWT_SECRET || 'secretKey_EC05_Voucher_System',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { getJwtSecret } from './jwt-secret';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';

/**
 * Module quản lý toàn bộ các cấu hình xác thực JWT, Passport và kết nối UsersModule.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordResetDeliveryService],
  exports: [AuthService],
})
export class AuthModule {}

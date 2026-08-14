import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '@prisma/client';

/**
 * Strategy giải mã và kiểm tra độ tin cậy của JWT được gửi kèm trong header Authorization Bearer.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Trong môi trường thực tế, JWT_SECRET phải được tải từ biến môi trường
      secretOrKey: process.env.JWT_SECRET || 'secretKey_EC05_Voucher_System',
    });
  }

  /**
   * Phương thức validate được gọi tự động sau khi token được giải mã thành công.
   * @param payload Dữ liệu chứa bên trong JWT (userId gán ở 'sub')
   * @returns Đối tượng User đã đăng nhập
   * @throws UnauthorizedException nếu không tìm thấy user hoặc tài khoản đã bị khóa (RB-08)
   */
  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại trên hệ thống.');
    }

    // Chặn tức thì các request từ tài khoản đã bị khóa (RB-08)
    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản này đã bị khóa. Vui lòng liên hệ Admin.');
    }

    return user;
  }
}

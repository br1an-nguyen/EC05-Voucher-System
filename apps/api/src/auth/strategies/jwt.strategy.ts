import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '@prisma/client';
import { getJwtSecret } from '../jwt-secret';

interface AccessTokenPayload {
  sub?: string;
  purpose?: string;
  iat?: number;
}

/**
 * Strategy giải mã và kiểm tra độ tin cậy của JWT được gửi kèm trong header Authorization Bearer.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /**
   * Phương thức validate được gọi tự động sau khi token được giải mã thành công.
   * @param payload Dữ liệu chứa bên trong JWT (userId gán ở 'sub')
   * @returns Đối tượng User đã đăng nhập
   * @throws UnauthorizedException nếu không tìm thấy user hoặc tài khoản đã bị khóa (RB-08)
   */
  async validate(payload: AccessTokenPayload) {
    if (payload?.purpose !== 'access') {
      throw new UnauthorizedException('Token không đúng mục đích truy cập.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token không chứa định danh người dùng.');
    }

    const user = await this.usersService.findById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại trên hệ thống.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản chưa được kích hoạt hoặc đã bị khóa.');
    }

    const issuedAt = typeof payload.iat === 'number' ? payload.iat * 1000 : 0;
    if (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực sau khi đổi mật khẩu.');
    }

    return {
      userId: user.userId,
      role: user.role,
      partnerId: user.partnerId,
      branchId: user.branchId,
      status: user.status,
    };
  }
}

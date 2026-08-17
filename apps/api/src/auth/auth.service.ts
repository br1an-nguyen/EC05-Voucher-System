import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  PartnerAccountStatus,
  PartnerApprovalStatus,
  User,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const PUBLIC_REGISTRATION_ROLES = new Set<UserRole>([
  UserRole.CUSTOMER,
  UserRole.PARTNER,
]);
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Service xử lý logic liên quan đến xác thực và phân quyền:
 * Đăng ký tài khoản (bao gồm cả tài khoản đối tác), đăng nhập và phát hành JWT.
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Đăng ký tài khoản người dùng mới.
   * Nếu đăng ký vai trò đối tác (PARTNER), hệ thống tự động khởi tạo bản ghi trong bảng Partners.
   * @param registerDto DTO chứa dữ liệu đăng ký đầu vào
   * @throws BadRequestException nếu thiếu email/phone hoặc thiếu thông tin doanh nghiệp của đối tác
   * @throws ConflictException nếu email, phone hoặc taxCode đã tồn tại
   */
  async register(registerDto: RegisterDto) {
    const { email, phone, password, fullName, role, companyName, taxCode, representative } = registerDto;
    const normalizedEmail = email?.trim().toLowerCase() || null;

    if (!PUBLIC_REGISTRATION_ROLES.has(role)) {
      throw new BadRequestException(
        'Đăng ký công khai chỉ hỗ trợ tài khoản CUSTOMER hoặc PARTNER.',
      );
    }

    // Bước 1: Kiểm tra ràng buộc phải có email hoặc phone (được quy định ở quy tắc BR-CUS-01)
    if (!normalizedEmail && !phone) {
      throw new BadRequestException('Phải cung cấp email hoặc số điện thoại để đăng ký.');
    }

    // Bước 2: Kiểm tra trùng lặp email/phone
    if (normalizedEmail) {
      const existingUser = await this.usersService.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new ConflictException('Địa chỉ email đã được sử dụng.');
      }
    }

    if (phone) {
      const existingUser = await this.usersService.findByPhone(phone);
      if (existingUser) {
        throw new ConflictException('Số điện thoại đã được sử dụng.');
      }
    }

    // Bước 3: Mã hóa mật khẩu sử dụng bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Bước 4: Thực hiện tạo bản ghi trong database transaction để đảm bảo tính nguyên tử (atomic)
    return this.prisma.$transaction(async (tx) => {
      // Khởi tạo tài khoản User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone,
          passwordHash,
          fullName,
          role,
          // Mặc định tài khoản mới của khách hàng là ACTIVE, đối tác và các vai trò khác cần xác thực/phê duyệt
          status: role === UserRole.CUSTOMER ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
        },
      });

      // Nếu người đăng ký là Đối tác (Partner)
      if (role === UserRole.PARTNER) {
        if (!companyName || !taxCode) {
          throw new BadRequestException('Thông tin đối tác phải bao gồm tên công ty và mã số thuế.');
        }

        // Kiểm tra trùng lặp mã số thuế
        const existingPartner = await tx.partner.findUnique({
          where: { taxCode },
        });
        if (existingPartner) {
          throw new ConflictException('Mã số thuế này đã được đăng ký hệ thống.');
        }

        // Tạo hồ sơ đối tác ở trạng thái PENDING chờ admin duyệt
        await tx.partner.create({
          data: {
            partnerId: user.userId,
            companyName,
            taxCode,
            representative,
            approvalStatus: PartnerApprovalStatus.PENDING,
            accountStatus: PartnerAccountStatus.ACTIVE,
          },
        });
      }

      // Ẩn hash mật khẩu trước khi trả về kết quả
      return this.toPublicUser(user);
    });
  }

  /**
   * Xác thực thông tin đăng nhập và cấp tokens.
   * @param loginDto DTO chứa thông tin đăng nhập
   * @throws BadRequestException nếu thiếu phương thức đăng nhập
   * @throws ConflictException hoặc BadRequestException nếu thông tin đăng nhập sai hoặc tài khoản bị khóa
   */
  async login(loginDto: LoginDto) {
    const { email, phone, password } = loginDto;
    let user = null;

    if (email) {
      user = await this.usersService.findByEmail(email.trim().toLowerCase());
    } else if (phone) {
      user = await this.usersService.findByPhone(phone);
    } else {
      throw new BadRequestException('Vui lòng cung cấp email hoặc số điện thoại để đăng nhập.');
    }

    if (!user) {
      throw new BadRequestException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản chưa được kích hoạt hoặc đã bị khóa.');
    }

    // So khớp mật khẩu đã mã hóa
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    // Ký và sinh Access Token & Refresh Token
    const tokens = this.generateTokens(user.userId, user.role);
    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    });

    return {
      user: this.toPublicUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Sinh bộ đôi Access Token (15 phút) và Refresh Token (7 ngày).
   */
  private generateTokens(userId: string, role: UserRole) {
    const accessToken = this.jwtService.sign({ sub: userId, role, purpose: 'access' }, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign({ sub: userId, purpose: 'refresh' }, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    };
  }

  /**
   * Quay vòng Access Token bằng Refresh Token hợp lệ.
   */
  async refresh(token: string) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    if (!payload.sub || payload.purpose !== 'refresh') {
      throw new UnauthorizedException('Token không đúng mục đích làm mới phiên.');
    }

    const user = await this.usersService.findById(payload.sub);
    const tokenHash = this.hashToken(token);
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.refreshTokenHash !== tokenHash ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ.');
    }

    const tokens = this.generateTokens(user.userId, user.role);
    const rotated = await this.prisma.user.updateMany({
      where: {
        userId: user.userId,
        refreshTokenHash: tokenHash,
        status: UserStatus.ACTIVE,
      },
      data: {
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    });

    if (rotated.count !== 1) {
      throw new UnauthorizedException('Refresh token đã được sử dụng hoặc thu hồi.');
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(token: string): Promise<void> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      return;
    }

    if (!payload.sub || payload.purpose !== 'refresh') {
      return;
    }

    await this.prisma.user.updateMany({
      where: {
        userId: payload.sub,
        refreshTokenHash: this.hashToken(token),
      },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  /**
   * Yêu cầu đặt lại mật khẩu.
   * Gửi token đặt lại và không tiết lộ nếu tài khoản không tồn tại.
   */
  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Vui lòng nhập email để đặt lại mật khẩu.');
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      return {
        message: 'Nếu tài khoản tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu qua email. ',
      };
    }

    const resetToken = this.jwtService.sign(
      {
        sub: user.userId,
        email: user.email,
        purpose: 'password-reset',
      },
      { expiresIn: '15m' },
    );

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        passwordResetTokenHash: this.hashToken(resetToken),
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const response: Record<string, string> = {
      message: 'Nếu tài khoản tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu qua email.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.resetToken = resetToken;
      response.resetUrl = resetUrl;
    }

    return response;
  }

  /**
   * Xác nhận token đặt lại mật khẩu và cập nhật mật khẩu mới.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    if (!token) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ.');
    }

    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException('Mật khẩu mới phải có độ dài từ 8 đến 128 ký tự.');
    }

    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    if (!payload.sub || payload.purpose !== 'password-reset') {
      throw new BadRequestException('Token không đúng mục đích đặt lại mật khẩu.');
    }

    const tokenHash = this.hashToken(token);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.updateMany({
      where: {
        userId: payload.sub,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    if (updated.count !== 1) {
      throw new BadRequestException('Token đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.');
    }

    return {
      message: 'Mật khẩu đã được cập nhật thành công.',
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User) {
    return {
      userId: user.userId,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      partnerId: user.partnerId,
      branchId: user.branchId,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}

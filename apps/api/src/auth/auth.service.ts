import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole, UserStatus, PartnerApprovalStatus, PartnerAccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
      const { passwordHash: _, ...result } = user;
      return result;
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

    // Kiểm tra tài khoản có bị khóa hay không (RB-08)
    if (user.status === UserStatus.LOCKED) {
      throw new BadRequestException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
    }

    // So khớp mật khẩu đã mã hóa
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    // Ký và sinh Access Token & Refresh Token
    const tokens = await this.generateTokens(user.userId, user.role);

    const { passwordHash: _, ...userData } = user;
    return {
      user: userData,
      ...tokens,
    };
  }

  /**
   * Sinh bộ đôi Access Token (15 phút) và Refresh Token (7 ngày).
   */
  private async generateTokens(userId: string, role: UserRole) {
    const payload = { sub: userId, role };
    
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Quay vòng Access Token bằng Refresh Token hợp lệ.
   */
  async refresh(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return this.generateTokens(payload.sub, payload.role);
    } catch (e) {
      throw new BadRequestException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }
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

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return {
      message: 'Nếu tài khoản tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu qua email.',
      resetToken,
      resetUrl,
    };
  }

  /**
   * Xác nhận token đặt lại mật khẩu và cập nhật mật khẩu mới.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    if (!token) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    try {
      const payload = this.jwtService.verify(token);

      if (payload.purpose !== 'password-reset') {
        throw new BadRequestException('Token không đúng mục đích đặt lại mật khẩu.');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new BadRequestException('Tài khoản không tồn tại hoặc token không hợp lệ.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await this.prisma.user.update({
        where: { userId: user.userId },
        data: { passwordHash },
      });

      return {
        message: 'Mật khẩu đã được cập nhật thành công.',
      };
    } catch (error) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
  }
}

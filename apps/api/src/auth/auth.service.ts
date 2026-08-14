import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

    // Bước 1: Kiểm tra ràng buộc phải có email hoặc phone (được quy định ở quy tắc BR-CUS-01)
    if (!email && !phone) {
      throw new BadRequestException('Phải cung cấp email hoặc số điện thoại để đăng ký.');
    }

    // Bước 2: Kiểm tra trùng lặp email/phone
    if (email) {
      const existingUser = await this.usersService.findByEmail(email);
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
          email,
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
      user = await this.usersService.findByEmail(email);
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
}

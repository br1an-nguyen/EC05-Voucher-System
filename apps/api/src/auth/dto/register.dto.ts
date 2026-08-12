import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * DTO dữ liệu đầu vào cho yêu cầu đăng ký tài khoản.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống nếu sử dụng.' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  @MinLength(6, { message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' })
  password!: string;

  @IsString({ message: 'Họ tên phải là chuỗi ký tự.' })
  @IsOptional()
  fullName?: string;

  @IsEnum(UserRole, { message: 'Vai trò người dùng không hợp lệ.' })
  @IsNotEmpty({ message: 'Vai trò không được để trống.' })
  role!: UserRole;

  // Thuộc tính bổ sung cho đối tác (Partner)
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsString()
  @IsOptional()
  representative?: string;
}

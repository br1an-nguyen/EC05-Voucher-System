import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

/**
 * DTO dữ liệu đầu vào cho yêu cầu đăng nhập.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  @MinLength(6, { message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' })
  password!: string;
}

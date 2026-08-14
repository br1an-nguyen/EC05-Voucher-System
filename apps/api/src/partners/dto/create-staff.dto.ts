import { IsEmail, IsString, MinLength, IsUUID, IsOptional } from 'class-validator';

export class CreateStaffDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' })
  password: string;

  @IsString()
  fullName: string;

  @IsUUID('4', { message: 'ID chi nhánh không hợp lệ.' })
  branchId: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

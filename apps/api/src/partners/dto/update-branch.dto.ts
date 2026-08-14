import { IsString, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO dữ liệu đầu vào khi cập nhật chi nhánh.
 */
export class UpdateBranchDto {
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Địa chỉ chi nhánh phải là chuỗi ký tự.' })
  @IsOptional()
  address?: string;

  @IsNumber({}, { message: 'Vĩ độ phải là số thực.' })
  @IsOptional()
  latitude?: number;

  @IsNumber({}, { message: 'Kinh độ phải là số thực.' })
  @IsOptional()
  longitude?: number;
}

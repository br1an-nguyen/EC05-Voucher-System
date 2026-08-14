import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO dữ liệu đầu vào khi tạo chi nhánh mới.
 */
export class CreateBranchDto {
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống.' })
  name!: string;

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

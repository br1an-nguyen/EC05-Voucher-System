import { IsString, IsOptional } from 'class-validator';

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

}

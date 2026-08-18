import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

}

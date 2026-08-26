import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { VIETNAM_PROVINCE_CODES } from '../../common/constants/vietnam-provinces';

export class PublicCatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsIn(VIETNAM_PROVINCE_CODES, { message: 'Tỉnh/thành phố không hợp lệ.' })
  provinceCode?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortPrice?: 'asc' | 'desc';
}

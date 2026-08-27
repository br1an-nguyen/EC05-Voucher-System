import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ComplaintType } from '@prisma/client';

export class CreateComplaintDto {
  @IsEnum(ComplaintType)
  @IsNotEmpty()
  type: ComplaintType;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @IsUUID()
  @IsOptional()
  reviewId?: string;
}

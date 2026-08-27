import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ComplaintStatus } from '@prisma/client';

export class ReplyComplaintDto {
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  status: ComplaintStatus;

  @IsString()
  @IsNotEmpty()
  resolutionResponse: string;
}

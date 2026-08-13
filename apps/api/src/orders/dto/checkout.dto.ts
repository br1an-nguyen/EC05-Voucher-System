import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentProviderType } from '@prisma/client';

export class CheckoutDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự.' })
  recipientNote?: string;

  @IsEnum(PaymentProviderType, { message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, VNPAY).' })
  paymentProvider: PaymentProviderType;
}

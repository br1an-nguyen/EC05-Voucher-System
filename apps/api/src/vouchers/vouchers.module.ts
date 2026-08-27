import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VoucherExpiryProcessor } from './voucher-expiry.processor';

/**
 * Module kết nối VouchersController và VouchersService phục vụ cho việc tạo lập/xét duyệt chiến dịch.
 */
@Module({
  imports: [PrismaModule],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherExpiryProcessor],
  exports: [VouchersService],
})
export class VouchersModule {}

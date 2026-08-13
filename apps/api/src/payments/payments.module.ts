import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentFinalizationService],
  exports: [PaymentsService, PaymentFinalizationService],
})
export class PaymentsModule {}

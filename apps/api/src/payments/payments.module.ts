import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VnPayAdapter } from './adapters/vnpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentFinalizationService, VnPayAdapter, StripeAdapter, PaypalAdapter],
  exports: [PaymentsService, PaymentFinalizationService, VnPayAdapter, StripeAdapter, PaypalAdapter],
})
export class PaymentsModule {}

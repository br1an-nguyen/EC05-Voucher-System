import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VnPayAdapter } from './adapters/vnpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';
import { EmailService } from './email.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentFinalizationService,
    VnPayAdapter,
    StripeAdapter,
    PaypalAdapter,
    EmailService,
  ],
  exports: [
    PaymentsService,
    PaymentFinalizationService,
    VnPayAdapter,
    StripeAdapter,
    PaypalAdapter,
    EmailService,
  ],
})
export class PaymentsModule {}


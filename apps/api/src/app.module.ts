import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PartnersModule } from './partners/partners.module';
import { VouchersModule } from './vouchers/vouchers.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, PartnersModule, VouchersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

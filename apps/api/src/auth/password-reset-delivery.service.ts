import { Injectable, Logger } from '@nestjs/common';

export interface PasswordResetDelivery {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);
  private readonly mode: 'DISABLED' | 'CONSOLE';

  constructor() {
    const configured = (process.env.AUTH_RESET_DELIVERY ?? 'DISABLED')
      .trim()
      .toUpperCase();
    if (configured !== 'DISABLED' && configured !== 'CONSOLE') {
      throw new Error('AUTH_RESET_DELIVERY must be DISABLED or CONSOLE.');
    }
    const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
    if (configured === 'CONSOLE' && appEnv !== 'development') {
      throw new Error(
        'AUTH_RESET_DELIVERY=CONSOLE is only allowed when APP_ENV=development.',
      );
    }
    this.mode = configured;
  }

  deliver(delivery: PasswordResetDelivery): void {
    if (this.mode !== 'CONSOLE') {
      return;
    }
    this.logger.warn(
      `Development-only password reset link for ${delivery.email}: ${delivery.resetUrl} (expires ${delivery.expiresAt.toISOString()})`,
    );
  }
}

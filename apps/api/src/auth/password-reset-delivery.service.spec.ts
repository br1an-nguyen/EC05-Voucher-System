import { PasswordResetDeliveryService } from './password-reset-delivery.service';

describe('PasswordResetDeliveryService configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_RESET_DELIVERY;
    process.env.APP_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to disabled delivery', () => {
    const service = new PasswordResetDeliveryService();
    expect(
      service.deliver({
        email: 'customer@example.com',
        resetUrl: 'https://frontend.example/reset?token=secret',
        expiresAt: new Date(),
      }),
    ).toBeUndefined();
  });

  it('rejects console token delivery outside development', () => {
    process.env.AUTH_RESET_DELIVERY = 'CONSOLE';
    process.env.APP_ENV = 'production';
    expect(() => new PasswordResetDeliveryService()).toThrow(
      'CONSOLE is only allowed when APP_ENV=development',
    );
  });

  it('rejects unknown delivery modes', () => {
    process.env.AUTH_RESET_DELIVERY = 'HTTP_RESPONSE';
    expect(() => new PasswordResetDeliveryService()).toThrow(
      'must be DISABLED or CONSOLE',
    );
  });
});

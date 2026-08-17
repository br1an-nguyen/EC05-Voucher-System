import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
  });

  const activeUser = {
    userId: 'user-1',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    passwordChangedAt: null,
  };

  it('accepts only access-purpose tokens', async () => {
    const usersService = { findById: jest.fn() };
    const strategy = new JwtStrategy(usersService as any);

    await expect(
      strategy.validate({ sub: activeUser.userId, purpose: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects access tokens issued before a password change', async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        ...activeUser,
        passwordChangedAt: new Date('2026-08-17T10:00:00.000Z'),
      }),
    };
    const strategy = new JwtStrategy(usersService as any);

    await expect(
      strategy.validate({
        sub: activeUser.userId,
        purpose: 'access',
        iat: Math.floor(new Date('2026-08-17T09:59:00.000Z').getTime() / 1000),
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

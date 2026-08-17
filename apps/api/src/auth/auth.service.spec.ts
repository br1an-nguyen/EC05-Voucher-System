import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '@prisma/client';
import { createHash } from 'crypto';

describe('AuthService password reset', () => {
  const mockUser = {
    userId: 'user-1',
    email: 'customer@example.com',
    phone: null,
    passwordHash: 'old-hash',
    fullName: 'Customer Test',
    role: UserRole.CUSTOMER,
    partnerId: null,
    branchId: null,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordChangedAt: null,
  };

  it('should generate a reset token for an existing account even with uppercase email input', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const jwtService = {
      sign: jest.fn().mockReturnValue('generated-token'),
      verify: jest.fn().mockReturnValue({ sub: 'user-1', purpose: 'password-reset' }),
    };

    const service = new AuthService(usersService as any, jwtService as any, { user: { update: jest.fn() } } as any);

    const result = await service.requestPasswordReset({ email: 'Customer@Example.com ' });

    expect(usersService.findByEmail).toHaveBeenCalledWith('customer@example.com');
    expect(jwtService.sign).toHaveBeenCalled();
    expect(result.resetToken).toBe('generated-token');
    expect(result.message).toContain('Nếu tài khoản tồn tại');
  });

  it('should reject an invalid or expired reset token', async () => {
    const usersService = {
      findByEmail: jest.fn(),
    };

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new AuthService(usersService as any, { sign: jest.fn() } as any, prisma as any);

    await expect(service.resetPassword({ token: 'invalid-token', newPassword: 'newPassword123' })).rejects.toThrow(BadRequestException);
  });

  it('should reject an elevated role even if validation is bypassed', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new AuthService({} as any, {} as any, prisma as any);

    await expect(
      service.register({
        email: 'attacker@example.com',
        password: 'Password123!',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject login for an account that is not active', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
      }),
    };
    const service = new AuthService(usersService as any, {} as any, {} as any);

    await expect(
      service.login({ email: mockUser.email, password: 'Password123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject an access token at the refresh endpoint', async () => {
    const usersService = { findById: jest.fn() };
    const jwtService = {
      verify: jest.fn().mockReturnValue({ sub: mockUser.userId, purpose: 'access' }),
    };
    const service = new AuthService(usersService as any, jwtService as any, {} as any);

    await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('should rotate a matching refresh token atomically', async () => {
    const oldToken = 'old-refresh-token';
    const oldHash = createHash('sha256').update(oldToken).digest('hex');
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        ...mockUser,
        refreshTokenHash: oldHash,
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    };
    const jwtService = {
      verify: jest.fn().mockReturnValue({ sub: mockUser.userId, purpose: 'refresh' }),
      sign: jest
        .fn()
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token'),
    };
    const prisma = { user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new AuthService(usersService as any, jwtService as any, prisma as any);

    await expect(service.refresh(oldToken)).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ refreshTokenHash: oldHash }),
      }),
    );
  });

  it('should reject a reset token that has already been consumed', async () => {
    const jwtService = {
      verify: jest.fn().mockReturnValue({
        sub: mockUser.userId,
        purpose: 'password-reset',
      }),
    };
    const prisma = { user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new AuthService({} as any, jwtService as any, prisma as any);

    await expect(
      service.resetPassword({ token: 'used-token', newPassword: 'NewPassword123!' }),
    ).rejects.toThrow(BadRequestException);
  });
});

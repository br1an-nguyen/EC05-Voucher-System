import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '@prisma/client';

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
    passwordResetToken: null,
    passwordResetExpiresAt: null,
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
});

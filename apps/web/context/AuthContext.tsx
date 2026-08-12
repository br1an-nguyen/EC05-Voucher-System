'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

interface User {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: 'CUSTOMER' | 'PARTNER' | 'PARTNER_STAFF' | 'ADMIN';
  partnerId: string | null;
  branchId: string | null;
  status: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginData: any) => Promise<void>;
  register: (registerData: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider quản lý trạng thái đăng nhập, phân quyền (Auth & RBAC) trên Frontend.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Bước 1: Khôi phục phiên làm việc từ localStorage khi component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    }
  }, []);

  /**
   * Đăng nhập tài khoản và lưu tokens, thông tin user.
   * Điều hướng dựa theo vai trò (Role-based Routing) sau khi đăng nhập thành công.
   */
  const login = async (loginData: any) => {
    setLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });

      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);

      // Điều hướng thông minh dựa vào vai trò (RBAC)
      if (res.user.role === 'ADMIN') {
        router.push('/admin');
      } else if (res.user.role === 'PARTNER') {
        router.push('/partner');
      } else if (res.user.role === 'PARTNER_STAFF') {
        router.push('/partner/validate'); // Nhân viên quét mã chuyển thẳng đến trang quét QR
      } else {
        router.push('/'); // Khách hàng chuyển đến trang chủ catalog
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Đăng ký tài khoản mới.
   */
  const register = async (registerData: any) => {
    setLoading(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
      
      // Đăng nhập tự động sau khi đăng ký thành công nếu là khách hàng
      if (registerData.role === 'CUSTOMER') {
        await login({
          email: registerData.email,
          phone: registerData.phone,
          password: registerData.password,
        });
      } else {
        // Đối tác đăng ký xong cần chờ duyệt (status: PENDING_VERIFICATION)
        router.push('/login?registered=partner');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Đăng xuất, dọn sạch bộ nhớ và đưa về trang chủ.
   */
  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được đặt trong AuthProvider');
  }
  return context;
};

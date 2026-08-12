'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Phone, Lock, Ticket, ArrowRight, AlertCircle, Info } from 'lucide-react';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email hoặc Số điện thoại.'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự.'),
});

type LoginSchemaType = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login, loading } = useAuth();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'partner') {
      setShowPartnerInfo(true);
    }
  }, [searchParams]);

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchemaType) => {
    setErrorMsg(null);
    const isEmail = data.identifier.includes('@');
    
    const payload = {
      [isEmail ? 'email' : 'phone']: data.identifier,
      password: data.password,
    };

    try {
      await login(payload);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md border border-slate-800">
        
        {/* LOGO & TIÊU ĐỀ */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
            Đăng nhập Hệ thống
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Trải nghiệm mua sắm và đổi voucher tiện lợi
          </p>
        </div>

        {/* THÔNG BÁO CHO ĐỐI TÁC VỪA ĐĂNG KÝ */}
        {showPartnerInfo && (
          <div className="flex items-start gap-3 rounded-lg bg-indigo-500/10 p-4 border border-indigo-500/20 text-indigo-200 text-sm leading-relaxed">
            <Info className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Đăng ký đối tác thành công!</span>
              <p className="mt-1 text-xs text-slate-300">
                Hồ sơ doanh nghiệp đang chờ Admin phê duyệt. Hệ thống sẽ gửi thông báo kích hoạt khi hoàn tất.
              </p>
            </div>
          </div>
        )}

        {/* THÔNG BÁO LỖI NẾU ĐĂNG NHẬP THẤT BẠI */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-200 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* FORM ĐĂNG NHẬP */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* EMAIL / SỐ ĐIỆN THOẠI */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email hoặc Số điện thoại
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  {...formRegister('identifier')}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  placeholder="name@example.com hoặc 0901234567"
                />
              </div>
              {errors.identifier && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* MẬT KHẨU */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  {...formRegister('password')}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* NÚT SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-3 px-4 text-sm font-semibold text-white hover:from-indigo-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            {!loading && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        {/* LINK CHUYỂN TRANG ĐĂNG KÝ */}
        <div className="text-center text-sm text-slate-500 pt-4 border-t border-slate-800/60">
          Chưa có tài khoản?{' '}
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Đăng ký ngay
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

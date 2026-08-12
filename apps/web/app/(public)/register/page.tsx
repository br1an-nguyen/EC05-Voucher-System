'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';
import { Ticket, ArrowRight, AlertCircle, User, Briefcase, Mail, Phone, Lock, Building, FileText } from 'lucide-react';

const registerSchema = z.object({
  role: z.enum(['CUSTOMER', 'PARTNER']),
  email: z.string().email('Email không đúng định dạng.').or(z.literal('')),
  phone: z.string().min(10, 'Số điện thoại phải từ 10 ký tự trở lên.').or(z.literal('')),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự.'),
  fullName: z.string().min(1, 'Họ tên không được để trống.'),
  companyName: z.string().optional(),
  taxCode: z.string().optional(),
  representative: z.string().optional(),
}).refine((data) => {
  // Ràng buộc 1: Phải điền email hoặc số điện thoại (BR-CUS-01)
  return data.email !== '' || data.phone !== '';
}, {
  message: 'Bạn phải nhập ít nhất Email hoặc Số điện thoại để đăng ký.',
  path: ['email'],
}).refine((data) => {
  // Ràng buộc 2: Đối tác phải điền thông tin doanh nghiệp
  if (data.role === 'PARTNER') {
    return !!data.companyName && !!data.taxCode;
  }
  return true;
}, {
  message: 'Vui lòng cung cấp Tên công ty và Mã số thuế đối tác.',
  path: ['companyName'],
});

type RegisterSchemaType = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: authRegister, loading } = useAuth();
  const [role, setRole] = useState<'CUSTOMER' | 'PARTNER'>('CUSTOMER');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register: formRegister,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<RegisterSchemaType>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'CUSTOMER',
      email: '',
      phone: '',
      password: '',
      fullName: '',
    },
  });

  const handleRoleChange = (selectedRole: 'CUSTOMER' | 'PARTNER') => {
    setRole(selectedRole);
    setValue('role', selectedRole);
    clearErrors();
  };

  const onSubmit = async (data: RegisterSchemaType) => {
    setErrorMsg(null);
    
    // Chuẩn bị payload gửi lên API
    const payload: any = {
      role: data.role,
      password: data.password,
      fullName: data.fullName,
    };
    
    if (data.email) payload.email = data.email;
    if (data.phone) payload.phone = data.phone;
    
    if (data.role === 'PARTNER') {
      payload.companyName = data.companyName;
      payload.taxCode = data.taxCode;
      payload.representative = data.representative || data.fullName; // lấy họ tên làm người đại diện nếu không nhập
    }

    try {
      await authRegister(payload);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 rounded-2xl bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md border border-slate-800">
        
        {/* LOGO & TIÊU ĐỀ */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
            Đăng ký Tài khoản
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Trở thành Khách hàng hoặc Đối tác kinh doanh ngay hôm nay
          </p>
        </div>

        {/* BỘ LỰA CHỌN VAI TRÒ */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => handleRoleChange('CUSTOMER')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${
              role === 'CUSTOMER'
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="h-4 w-4" />
            Khách hàng
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('PARTNER')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${
              role === 'PARTNER'
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Đối tác doanh nghiệp
          </button>
        </div>

        {/* THÔNG BÁO LỖI NẾU CÓ */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-200 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* FORM ĐĂNG KÝ */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            
            {/* HỌ VÀ TÊN */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {role === 'CUSTOMER' ? 'Họ và tên' : 'Họ tên người đại diện'}
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  {...formRegister('fullName')}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  placeholder={role === 'CUSTOMER' ? 'Nguyễn Văn A' : 'Trần Văn Đại Diện'}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  {...formRegister('email')}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* SỐ ĐIỆN THOẠI */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Số điện thoại
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  {...formRegister('phone')}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  placeholder="0901234567"
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* MẬT KHẨU */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mật khẩu
              </label>
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
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* THÔNG TIN DOANH NGHIỆP DÀNH CHO ĐỐI TÁC */}
            {role === 'PARTNER' && (
              <div className="space-y-4 border-t border-slate-800/80 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-indigo-400">Thông tin Doanh nghiệp</h3>
                
                {/* TÊN CÔNG TY */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Tên công ty / Cửa hàng
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Building className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      {...formRegister('companyName')}
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                      placeholder="Công ty TNHH Dịch vụ ABC"
                    />
                  </div>
                  {errors.companyName && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.companyName.message}
                    </p>
                  )}
                </div>

                {/* MÃ SỐ THUẾ */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Mã số thuế
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      {...formRegister('taxCode')}
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                      placeholder="0101234567"
                    />
                  </div>
                  {errors.taxCode && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.taxCode.message}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* NÚT SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-3 px-4 text-sm font-semibold text-white hover:from-indigo-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            {!loading && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        {/* LINK QUAY LẠI TRANG ĐĂNG NHẬP */}
        <div className="text-center text-sm text-slate-500 pt-4 border-t border-slate-800/60">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Đăng nhập ngay
          </Link>
        </div>

      </div>
    </div>
  );
}

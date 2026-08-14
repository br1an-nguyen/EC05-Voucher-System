'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  UserPlus, 
  Store, 
  Mail, 
  Lock, 
  User, 
  Phone,
  AlertCircle,
  CheckCircle,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Form validation schema
const staffSchema = z.object({
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự.'),
  fullName: z.string().min(2, 'Họ và tên phải dài ít nhất 2 ký tự.'),
  phone: z.string().optional(),
  branchId: z.string().uuid('Vui lòng chọn chi nhánh hợp lệ.'),
});

type StaffFormInput = z.infer<typeof staffSchema>;

interface Branch {
  branchId: string;
  name: string;
}

interface StaffUser {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  createdAt: string;
  branch: {
    name: string;
  } | null;
}

export default function PartnerStaffPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      phone: '',
      branchId: '',
    }
  });

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [staffData, branchData] = await Promise.all([
        apiRequest('/partners/staff'),
        apiRequest('/partners/branches'),
      ]);
      setStaffList(staffData);
      setBranches(branchData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải dữ liệu nhân viên.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'PARTNER') {
        router.push('/login?redirect=/partner/staff');
      } else {
        loadData();
      }
    }
  }, [user, authLoading]);

  const onSubmit = async (data: StaffFormInput) => {
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest('/partners/staff', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setSuccessMsg('Đã tạo thành công tài khoản nhân viên!');
      reset();
      setModalOpen(false);
      loadData(); // Reload staff list
    } catch (err: any) {
      setErrorMsg(err.message || 'Tạo nhân viên thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Đối tác</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý nhân viên</span>
      </div>

      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Nhân viên cửa hàng
          </h1>
          <p className="text-xs text-muted mt-1">Quản lý tài khoản nhân viên phụ trách quét và đổi mã voucher tại các chi nhánh.</p>
        </div>

        <button
          onClick={() => {
            setSuccessMsg(null);
            setErrorMsg(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2.5 text-xs font-bold transition-colors shadow shadow-primary/10"
        >
          <UserPlus className="h-4 w-4" />
          Thêm nhân viên mới
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* DANH SÁCH NHÂN VIÊN */}
      {staffList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Users className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Chưa có tài khoản nhân viên nào</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Hãy nhấp vào nút "Thêm nhân viên mới" để tạo tài khoản phân quyền quét mã cho cửa hàng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff) => {
            const date = new Date(staff.createdAt).toLocaleDateString('vi-VN');
            return (
              <div key={staff.userId} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {staff.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm leading-snug">{staff.fullName}</h3>
                    <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                      <Store className="h-3 w-3 text-primary shrink-0" />
                      Chi nhánh: <span className="font-semibold text-foreground">{staff.branch?.name || 'Chưa gán'}</span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-3 text-xs text-muted space-y-1.5">
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-semibold text-foreground">{staff.email}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex justify-between">
                      <span>Điện thoại:</span>
                      <span className="font-semibold text-foreground">{staff.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Ngày tạo:</span>
                    <span className="font-semibold text-foreground">{date}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM NHÂN VIÊN MỚI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl space-y-4 animate-scale-up">
            
            <div className="pb-3 border-b border-border">
              <h3 className="font-extrabold text-foreground text-base">Thêm nhân viên mới</h3>
              <p className="text-[11px] text-muted">Tạo tài khoản phụ trách cho nhân viên đứng quầy thu ngân.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              
              {/* Chi nhánh */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wide">Chi nhánh gán cố định</label>
                <select
                  {...register('branchId')}
                  className="block w-full rounded-lg border border-border bg-card py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">-- Chọn chi nhánh cửa hàng --</option>
                  {branches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.branchId && (
                  <p className="text-[10px] text-primary">{errors.branchId.message}</p>
                )}
              </div>

              {/* Họ tên */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wide">Họ và tên nhân viên</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    {...register('fullName')}
                    className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errors.fullName && (
                  <p className="text-[10px] text-primary">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wide">Địa chỉ Email đăng nhập</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="staff@company.com"
                    {...register('email')}
                    className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-primary">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wide">Mật khẩu ban đầu</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    {...register('password')}
                    className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errors.password && (
                  <p className="text-[10px] text-primary">{errors.password.message}</p>
                )}
              </div>

              {/* Điện thoại */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wide">Số điện thoại (Tùy chọn)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    {...register('phone')}
                    className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-slate-50 text-foreground text-xs font-bold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  ChevronRight,
  Edit2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Form validation schema for creating staff
const createStaffSchema = z.object({
  email: z.string().email('Email không hợp lệ.'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.')
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự.'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận lại mật khẩu.'),
  fullName: z.string().min(2, 'Họ và tên phải dài ít nhất 2 ký tự.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập số điện thoại.')
    .superRefine((value, ctx) => {
      if (/[A-Za-z]/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số điện thoại không được chứa chữ.',
        });
        return;
      }

      if (/[^0-9+\-()\s]/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số điện thoại không được chứa ký tự đặc biệt.',
        });
        return;
      }

      const digitCount = value.replace(/\D/g, '').length;
      if (digitCount < 9 || digitCount > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số điện thoại phải có từ 9 đến 15 chữ số.',
        });
      }
    }),
  branchId: z.string().uuid('Vui lòng chọn chi nhánh hợp lệ.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu và xác nhận mật khẩu không khớp.',
  path: ['confirmPassword'],
});

type CreateStaffFormInput = z.infer<typeof createStaffSchema>;

// Form validation schema for editing staff (password optional)
const editStaffSchema = z.object({
  fullName: z.string().min(2, 'Họ và tên phải dài ít nhất 2 ký tự.'),
  branchId: z.string().uuid('Vui lòng chọn chi nhánh hợp lệ.'),
  password: z.string().optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: 'Mật khẩu mới và xác nhận mật khẩu không khớp.',
  path: ['confirmPassword'],
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password.length >= 6;
  }
  return true;
}, {
  message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
  path: ['password'],
});

type EditStaffFormInput = z.infer<typeof editStaffSchema>;

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
  branchId: string | null;
  branch: {
    name: string;
    branchId: string;
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

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  // Visibility password toggles
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);
  const [showEditConfirmPass, setShowEditConfirmPass] = useState(false);
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const editFormRef = useRef<HTMLFormElement | null>(null);

  // Form for creating staff
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    setError: setCreateError,
    clearErrors: clearCreateErrors,
    formState: { errors: errorsCreate },
  } = useForm<CreateStaffFormInput>({
    resolver: zodResolver(createStaffSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
      branchId: '',
    }
  });

  // Form for editing staff
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: errorsEdit },
  } = useForm<EditStaffFormInput>({
    resolver: zodResolver(editStaffSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      fullName: '',
      branchId: '',
      password: '',
      confirmPassword: '',
    }
  });

  useEffect(() => {
    if (!createModalOpen || !createFormRef.current) return;

    const orderedFields: Array<keyof CreateStaffFormInput> = [
      'branchId',
      'fullName',
      'email',
      'password',
      'confirmPassword',
      'phone',
    ];

    const firstInvalidField = orderedFields.find((field) => Boolean(errorsCreate[field]));
    if (!firstInvalidField) return;

    const target = createFormRef.current.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }, [errorsCreate, createModalOpen]);

  useEffect(() => {
    if (!editingStaff || !editFormRef.current) return;

    const orderedFields: Array<keyof EditStaffFormInput> = [
      'branchId',
      'fullName',
      'password',
      'confirmPassword',
    ];

    const firstInvalidField = orderedFields.find((field) => Boolean(errorsEdit[field]));
    if (!firstInvalidField) return;

    const target = editFormRef.current.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }, [errorsEdit, editingStaff]);

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

  // Set default values when editing a staff user
  useEffect(() => {
    if (editingStaff) {
      setEditValue('fullName', editingStaff.fullName || '');
      setEditValue('branchId', editingStaff.branchId || '');
      setEditValue('password', '');
      setEditValue('confirmPassword', '');
      setShowEditPass(false);
      setShowEditConfirmPass(false);
    }
  }, [editingStaff]);

  // Handle create
  const onCreateSubmit = async (data: CreateStaffFormInput) => {
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    clearCreateErrors(['email', 'phone']);
    try {
      await apiRequest('/partners/staff', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setSuccessMsg('Đã tạo thành công tài khoản nhân viên!');
      resetCreate();
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      const message = String(err?.message || '');

      if (message.includes('Email')) {
        setCreateError('email', { type: 'server', message });
      }

      if (message.includes('Số điện thoại')) {
        setCreateError('phone', { type: 'server', message });
      }

      if (!message.includes('Email') && !message.includes('Số điện thoại')) {
        setCreateError('email', { type: 'server', message: 'Tạo nhân viên thất bại. Vui lòng thử lại.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit
  const onEditSubmit = async (data: EditStaffFormInput) => {
    if (!editingStaff) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Build request body dynamically
      const body: any = {
        fullName: data.fullName,
        branchId: data.branchId,
      };
      if (data.password && data.password.length > 0) {
        body.password = data.password;
      }

      await apiRequest(`/partners/staff/${editingStaff.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSuccessMsg(`Cập nhật thông tin nhân viên "${data.fullName}" thành công!`);
      setEditingStaff(null);
      resetEdit();
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cập nhật nhân viên thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDeleteStaff = async (staff: StaffUser) => {
    const confirm = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản nhân viên "${staff.fullName}"?`);
    if (!confirm) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest(`/partners/staff/${staff.userId}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Đã xóa thành công tài khoản nhân viên "${staff.fullName}".`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xóa tài khoản nhân viên này.');
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
          <p className="text-xs text-muted mt-1">Cấp tài khoản, chỉnh sửa địa điểm gán chi nhánh hoặc xóa nhân sự thu ngân.</p>
        </div>

        <button
          onClick={() => {
            setSuccessMsg(null);
            setErrorMsg(null);
            resetCreate();
            setShowPass(false);
            setShowConfirmPass(false);
            setCreateModalOpen(true);
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
              <div key={staff.userId} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative">
                
                {/* Actions overlay buttons on card top-right */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSuccessMsg(null);
                      setErrorMsg(null);
                      setEditingStaff(staff);
                    }}
                    className="p-1.5 text-muted hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                    title="Chỉnh sửa tài khoản"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(staff)}
                    className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa nhân viên"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-3 pr-16 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {staff.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground text-sm leading-snug truncate max-w-full">{staff.fullName}</h3>
                    <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5 min-w-0">
                      <Store className="h-3 w-3 text-primary shrink-0" />
                      <span className="shrink-0">Chi nhánh:</span>
                      <span className="font-semibold text-foreground truncate max-w-[12rem] inline-block align-bottom min-w-0">
                        {staff.branch?.name || 'Chưa gán'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-3 text-xs text-muted space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0">Email:</span>
                    <span className="font-semibold text-foreground text-right break-all min-w-0 flex-1">{staff.email}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="shrink-0">Điện thoại:</span>
                      <span className="font-semibold text-foreground text-right break-all min-w-0 flex-1">{staff.phone}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0">Ngày tạo:</span>
                    <span className="font-semibold text-foreground text-right min-w-0 flex-1">{date}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: THÊM NHÂN VIÊN MỚI */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card border border-border rounded-2xl w-[min(92vw,520px)] h-[84vh] max-h-[720px] p-3.5 sm:p-4 relative shadow-2xl space-y-2.5 animate-scale-up flex flex-col overflow-hidden">
            
            <div className="pb-2 border-b border-border">
              <h3 className="font-extrabold text-foreground text-sm">Thêm nhân viên mới</h3>
              <p className="text-[10px] text-muted">Tạo tài khoản phụ trách cho nhân viên đứng quầy thu ngân.</p>
            </div>

            <form ref={createFormRef} onSubmit={handleSubmitCreate(onCreateSubmit)} className="space-y-2 overflow-y-auto pr-0.5 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              
              {/* Chi nhánh */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Chi nhánh gán cố định</label>
                <select
                  {...registerCreate('branchId')}
                  className="block w-full rounded-lg border border-border bg-card py-1.5 px-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">-- Chọn chi nhánh cửa hàng --</option>
                  {branches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errorsCreate.branchId && (
                  <p className="text-[9px] text-primary">{errorsCreate.branchId.message}</p>
                )}
              </div>

              {/* Họ tên */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Họ và tên nhân viên</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    {...registerCreate('fullName')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errorsCreate.fullName && (
                  <p className="text-[9px] text-primary">{errorsCreate.fullName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Địa chỉ Email đăng nhập</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="staff@company.com"
                    {...registerCreate('email')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Mail className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errorsCreate.email && (
                  <p className="text-[9px] text-primary">{errorsCreate.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Mật khẩu ban đầu</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Tối thiểu 6 ký tự"
                    {...registerCreate('password')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-8 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsCreate.password && (
                  <p className="text-[9px] text-primary">{errorsCreate.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Nhập lại mật khẩu</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    placeholder="Xác nhận trùng khớp mật khẩu"
                    {...registerCreate('confirmPassword')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-8 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-foreground"
                  >
                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsCreate.confirmPassword && (
                  <p className="text-[9px] text-primary">{errorsCreate.confirmPassword.message}</p>
                )}
              </div>

              {/* Điện thoại */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Số điện thoại</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    {...registerCreate('phone')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errorsCreate.phone && (
                  <p className="text-[9px] text-primary">{errorsCreate.phone.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-border hover:bg-slate-50 text-foreground text-xs font-bold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHỈNH SỬA NHÂN VIÊN */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card border border-border rounded-2xl w-[min(92vw,520px)] h-[84vh] max-h-[720px] p-3.5 sm:p-4 relative shadow-2xl space-y-2.5 animate-scale-up flex flex-col overflow-hidden">
            
            <div className="pb-2 border-b border-border">
              <h3 className="font-extrabold text-foreground text-sm">Chỉnh sửa thông tin nhân viên</h3>
              <p className="text-[10px] text-muted">Email đăng nhập gán cố định: <span className="font-bold text-foreground">{editingStaff.email}</span></p>
            </div>

            <form ref={editFormRef} onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-2 overflow-y-auto pr-0.5 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              
              {/* Chi nhánh */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Chi nhánh gán làm việc</label>
                <select
                  {...registerEdit('branchId')}
                  className="block w-full rounded-lg border border-border bg-card py-1.5 px-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errorsEdit.branchId && (
                  <p className="text-[9px] text-primary">{errorsEdit.branchId.message}</p>
                )}
              </div>

              {/* Họ tên */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Họ và tên nhân viên</label>
                <div className="relative">
                  <input
                    type="text"
                    {...registerEdit('fullName')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errorsEdit.fullName && (
                  <p className="text-[9px] text-primary">{errorsEdit.fullName.message}</p>
                )}
              </div>

              {/* Password mới (Tùy chọn) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showEditPass ? 'text' : 'password'}
                    placeholder="Nhập nếu cần đổi mật khẩu nhân viên"
                    {...registerEdit('password')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-8 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-foreground"
                  >
                    {showEditPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsEdit.password && (
                  <p className="text-[9px] text-primary">{errorsEdit.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-foreground uppercase tracking-wide">Xác nhận lại mật khẩu</label>
                <div className="relative">
                  <input
                    type={showEditConfirmPass ? 'text' : 'password'}
                    placeholder="Xác nhận lại mật khẩu mới ở trên"
                    {...registerEdit('confirmPassword')}
                    className="block w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-8 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  />
                  <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPass(!showEditConfirmPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-foreground"
                  >
                    {showEditConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsEdit.confirmPassword && (
                  <p className="text-[9px] text-primary">{errorsEdit.confirmPassword.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-3 py-2 rounded-xl border border-border hover:bg-slate-50 text-foreground text-xs font-bold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

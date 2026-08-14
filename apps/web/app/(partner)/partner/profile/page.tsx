'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiRequest } from '../../../../lib/api';
import { Building, FileText, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

const profileSchema = z.object({
  companyName: z.string().min(1, 'Tên công ty không được để trống.'),
  taxCode: z.string().min(1, 'Mã số thuế không được để trống.'),
  representative: z.string().min(1, 'Người đại diện không được để trống.'),
});

type ProfileSchemaType = z.infer<typeof profileSchema>;

export default function PartnerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileSchemaType>({
    resolver: zodResolver(profileSchema),
  });

  // Bước 1: Fetch thông tin đối tác khi load trang
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiRequest('/partners/profile');
        setValue('companyName', data.companyName);
        setValue('taxCode', data.taxCode);
        setValue('representative', data.representative || '');
      } catch (err: any) {
        setErrorMsg(err.message || 'Không thể tải thông tin hồ sơ.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [setValue]);

  // Bước 2: Xử lý cập nhật thông tin khi submit form
  const onSubmit = async (data: ProfileSchemaType) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiRequest('/partners/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setSuccessMsg('Cập nhật hồ sơ doanh nghiệp thành công!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xảy ra trong quá trình lưu hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* TIÊU ĐỀ */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Hồ sơ Doanh nghiệp</h1>
        <p className="mt-1.5 text-sm text-muted">
          Quản lý thông tin pháp lý và thông tin liên hệ của doanh nghiệp đối tác
        </p>
      </div>

      {/* THÔNG BÁO THÀNH CÔNG/THẤT BẠI */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-4 border border-green-500/20 text-green-800 text-sm">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* FORM HỒ SƠ */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          
          {/* TÊN CÔNG TY */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Tên công ty / Cửa hàng
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                {...register('companyName')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                placeholder="Công ty TNHH Dịch vụ ABC"
              />
            </div>
            {errors.companyName && (
              <p className="mt-1.5 text-xs text-primary">{errors.companyName.message}</p>
            )}
          </div>

          {/* MÃ SỐ THUẾ */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Mã số thuế doanh nghiệp
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <FileText className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                {...register('taxCode')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                placeholder="0101234567"
              />
            </div>
            {errors.taxCode && (
              <p className="mt-1.5 text-xs text-primary">{errors.taxCode.message}</p>
            )}
          </div>

          {/* NGƯỜI ĐẠI DIỆN PHÁP LUẬT */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Người đại diện pháp luật
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <User className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                {...register('representative')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                placeholder="Nguyễn Văn Đại Diện"
              />
            </div>
            {errors.representative && (
              <p className="mt-1.5 text-xs text-primary">{errors.representative.message}</p>
            )}
          </div>

          {/* NÚT SUBMIT */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex w-full md:w-auto items-center justify-center rounded-lg bg-primary py-2.5 px-6 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

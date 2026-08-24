'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { MapPin, Plus, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../../../components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';

const branchSchema = z.object({
  name: z.string().min(1, 'Tên chi nhánh không được để trống.'),
  address: z.string().min(1, 'Địa chỉ không được để trống.'),
});

type BranchSchemaType = z.infer<typeof branchSchema>;

interface Branch {
  branchId: string;
  name: string;
  address: string | null;
}

export default function PartnerBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BranchSchemaType>({
    resolver: zodResolver(branchSchema),
  });

  const loadBranches = async () => {
    try {
      const data = await apiRequest<Branch[]>('/partners/branches');
      setBranches(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chi nhánh.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadBranches();
    });
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    reset({
      name: '',
      address: '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setValue('name', branch.name);
    setValue('address', branch.address || '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const onSubmit = async (data: BranchSchemaType) => {
    setErrorMsg(null);
    const payload = {
      name: data.name,
      address: data.address,
    };
    try {
      if (editingBranch) {
        // Cập nhật chi nhánh
        await apiRequest<void>(`/partners/branches/${editingBranch.branchId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Cập nhật chi nhánh thành công!');
      } else {
        // Tạo chi nhánh mới
        await apiRequest<void>('/partners/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Thêm chi nhánh mới thành công!');
      }
      setModalOpen(false);
      loadBranches();
      // Tự động tắt thông báo thành công sau 3 giây
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Có lỗi xảy ra.'));
    }
  };


  const handleDelete = async (branchId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/partners/branches/${branchId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Xóa chi nhánh thành công!');
      loadBranches();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể xóa chi nhánh này.'));
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
    <div className="space-y-6">
      
      {/* TIÊU ĐỀ & NÚT THÊM */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chi nhánh Cửa hàng</h1>
          <p className="mt-1.5 text-sm text-muted">
            Quản lý vị trí địa lý và các chi nhánh hoạt động áp dụng voucher
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm chi nhánh
        </button>
      </div>

      {/* THÔNG BÁO DƯỚI DẠNG TOAST */}
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

      {/* DANH SÁCH CHI NHÁNH */}
      {branches.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
          <MapPin className="h-10 w-10 text-muted/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Chưa có chi nhánh nào</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Bạn cần khởi tạo ít nhất một chi nhánh cửa hàng để có thể gán địa điểm áp dụng khi tạo chiến dịch voucher.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-secondary py-2 px-4 text-xs font-semibold text-primary hover:bg-secondary/70 transition-colors"
          >
            Tạo ngay chi nhánh đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div
              key={branch.branchId}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div>
                <h3 className="text-base font-bold text-foreground truncate">{branch.name}</h3>
                <div className="mt-3 flex items-start gap-2 text-xs text-muted leading-relaxed">
                  <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <p>{branch.address || 'Không có thông tin địa chỉ'}</p>
                </div>
              </div>

              {/* HÀNH ĐỘNG */}
              <div className="mt-5 border-t border-border/60 pt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => openEditModal(branch)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Sửa
                </button>
                <button
                  onClick={() => setBranchToDelete(branch)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG THÊM / SỬA CHI NHÁNH */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="border-b border-border pb-4 pr-8">
            <DialogTitle>
              {editingBranch ? 'Cập nhật chi nhánh' : 'Thêm chi nhánh mới'}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? 'Điều chỉnh tên và địa chỉ đang được sử dụng cho chi nhánh này.'
                : 'Thêm địa điểm áp dụng để có thể gán chi nhánh cho chiến dịch voucher.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="branch-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                Tên chi nhánh / Cửa hàng
              </label>
              <input
                id="branch-name"
                type="text"
                {...register('name')}
                placeholder="Ví dụ: Chi nhánh Quận 1"
                aria-invalid={Boolean(errors.name)}
                className="block w-full rounded-ui-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand focus:ring-3 focus:ring-brand/20 aria-invalid:border-danger aria-invalid:ring-danger/20"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="branch-address" className="mb-1.5 block text-xs font-semibold text-foreground">
                Địa chỉ chi tiết
              </label>
              <textarea
                id="branch-address"
                rows={3}
                {...register('address')}
                placeholder="Ví dụ: 123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. HCM"
                aria-invalid={Boolean(errors.address)}
                className="block w-full resize-none rounded-ui-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand focus:ring-3 focus:ring-brand/20 aria-invalid:border-danger aria-invalid:ring-danger/20"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-danger">{errors.address.message}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Hủy bỏ
              </DialogClose>
              <Button type="submit" size="sm">
                {editingBranch ? 'Lưu thay đổi' : 'Thêm mới'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG XÓA CHI NHÁNH */}
      <AlertDialog
        open={Boolean(branchToDelete)}
        onOpenChange={(open) => {
          if (!open) setBranchToDelete(null);
        }}
      >
        {branchToDelete && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa chi nhánh &quot;{branchToDelete.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Chi nhánh sẽ bị xóa khỏi danh sách địa điểm áp dụng voucher. Thao tác này
                không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete(branchToDelete.branchId)}>
                Xóa chi nhánh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

    </div>
  );
}

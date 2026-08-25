'use client';

import React, { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../../../../lib/api';
import { getErrorMessage } from '../../../../../lib/errors';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  MapPin, 
  Info,
  DollarSign,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../components/ui/select';

const voucherCategories = [
  { value: 'F&B', label: 'Buffet & Ăn uống (F&B)' },
  { value: 'Shopping', label: 'Mua sắm & Tiêu dùng (Shopping)' },
  { value: 'Beauty', label: 'Làm đẹp & Spa (Beauty)' },
  { value: 'Entertainment', label: 'Giải trí & Vui chơi (Entertainment)' },
  { value: 'Other', label: 'Khác' },
];

const campaignSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống.'),
  description: z.string().optional(),
  category: z.string().min(1, 'Vui lòng chọn danh mục.'),
  originalPrice: z.string().min(1, 'Giá gốc không được để trống.'),
  hasDiscount: z.boolean(),
  salePrice: z.string().optional(),
  saleStartTime: z.string().min(1, 'Thời gian bắt đầu bán không được để trống.'),
  saleEndTime: z.string().min(1, 'Thời gian kết thúc bán không được để trống.'),
  usageStartTime: z.string().min(1, 'Thời gian bắt đầu sử dụng không được để trống.'),
  usageEndTime: z.string().min(1, 'Thời gian kết thúc sử dụng không được để trống.'),
  capacity: z.string().min(1, 'Số lượng phát hành không được để trống.'),
  isMultiUse: z.boolean(),
  maxUsesPerCode: z.string().optional(),
  branchIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một chi nhánh áp dụng.'),
}).refine((data) => {
  // Ràng buộc RB-02: Giá khuyến mãi phải nhỏ hơn giá gốc
  if (!data.hasDiscount) return true;
  return (
    Boolean(data.salePrice) &&
    Number(data.salePrice) > 0 &&
    Number(data.salePrice) < Number(data.originalPrice)
  );
}, {
  message: 'Giá khuyến mãi bán ra phải nhỏ hơn giá gốc của voucher (RB-02).',
  path: ['salePrice'],
}).refine((data) => {
  // Ràng buộc RB-03: Hạn bán kết thúc sau khi bắt đầu
  return new Date(data.saleEndTime) > new Date(data.saleStartTime);
}, {
  message: 'Hạn bán kết thúc phải sau ngày bắt đầu bán (RB-03).',
  path: ['saleEndTime'],
}).refine((data) => {
  // Ràng buộc: Hạn sử dụng kết thúc sau khi bắt đầu
  return new Date(data.usageEndTime) > new Date(data.usageStartTime);
}, {
  message: 'Hạn sử dụng kết thúc phải sau ngày bắt đầu sử dụng.',
  path: ['usageEndTime'],
});

type CampaignSchemaType = z.infer<typeof campaignSchema>;

interface Branch {
  branchId: string;
  name: string;
  address: string | null;
}

export default function CreateVoucherPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<CampaignSchemaType>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      isMultiUse: false,
      hasDiscount: true,
      branchIds: [],
      category: '',
      originalPrice: '',
      salePrice: '',
      capacity: '',
      maxUsesPerCode: '',
    },
  });

  const isMultiUseSelected = useWatch({ control, name: 'isMultiUse' });
  const hasDiscountSelected = useWatch({ control, name: 'hasDiscount' });
  const multiUseRegistration = register('isMultiUse');

  // Load danh sách chi nhánh hoạt động của đối tác
  useEffect(() => {
    async function getBranches() {
      try {
        const data = await apiRequest<Branch[]>('/partners/branches');
        setBranches(data);
      } catch (error: unknown) {
        console.error('Không thể tải chi nhánh:', error);
      } finally {
        setLoadingBranches(false);
      }
    }
    getBranches();
  }, []);

  const onSubmit = async (data: CampaignSchemaType) => {
    setSaving(true);
    setErrorMsg(null);

    // Chuẩn bị payload chuẩn định dạng gửi lên NestJS API
    const payload = {
      title: data.title,
      description: data.description,
      category: data.category,
      originalPrice: Number(data.originalPrice),
      salePrice: data.hasDiscount ? Number(data.salePrice) : null,
      saleStartTime: new Date(data.saleStartTime).toISOString(),
      saleEndTime: new Date(data.saleEndTime).toISOString(),
      usageStartTime: new Date(data.usageStartTime).toISOString(),
      usageEndTime: new Date(data.usageEndTime).toISOString(),
      capacity: Number(data.capacity),
      isMultiUse: data.isMultiUse,
      maxUsesPerCode: data.maxUsesPerCode ? Number(data.maxUsesPerCode) : undefined,
      branchIds: data.branchIds,
    };

    try {
      await apiRequest<void>('/vouchers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.push('/partner/vouchers');
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi lưu chiến dịch voucher.'));
    } finally {
      setSaving(false);
    }
  };

  const handleBranchCheckboxChange = (branchId: string, checked: boolean) => {
    const currentBranchIds = getValues('branchIds') || [];
    let updatedBranchIds = [...currentBranchIds];
    if (checked) {
      updatedBranchIds.push(branchId);
    } else {
      updatedBranchIds = updatedBranchIds.filter((id) => id !== branchId);
    }
    setValue('branchIds', updatedBranchIds, { shouldValidate: true });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* HEADER QUAY LẠI */}
      <div className="flex items-center gap-3">
        <Link
          href="/partner/vouchers"
          className="p-2 rounded-lg border border-border bg-card text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tạo chiến dịch Voucher</h1>
          <p className="text-xs text-muted mt-0.5">Khởi tạo chương trình khuyến mãi và cấu hình thời gian áp dụng</p>
        </div>
      </div>

      {/* ALERT BÁO LỖI */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* FORM NHẬP CHI TIẾT */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* THÔNG TIN CƠ BẢN */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5 border-b border-border pb-3">
            <Sparkles className="h-4 w-4" />
            Thông tin chi tiết Voucher
          </h3>

          {/* TIÊU ĐỀ */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Tiêu đề chương trình khuyến mãi
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="Ví dụ: Buffet Nướng Thượng Hạng giảm 30%"
              className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-primary">{errors.title.message}</p>
            )}
          </div>

          {/* DANH MỤC & SỨC CHỨA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label id="voucher-category-label" className="block text-xs font-semibold text-foreground mb-1.5">
                Danh mục Voucher
              </label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    name={field.name}
                    items={voucherCategories}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? '')}
                  >
                    <SelectTrigger
                      aria-labelledby="voucher-category-label"
                      aria-invalid={Boolean(errors.category)}
                      className="w-full"
                    >
                      <SelectValue placeholder="Chọn danh mục..." />
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      {voucherCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="mt-1 text-xs text-danger">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Số lượng phát hành (Sức chứa)
              </label>
              <input
                type="number"
                {...register('capacity')}
                placeholder="Ví dụ: 100"
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.capacity && (
                <p className="mt-1 text-xs text-primary">{errors.capacity.message}</p>
              )}
            </div>
          </div>

          {/* MÔ TẢ CHI TIẾT */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Mô tả chi tiết & Điều khoản sử dụng
            </label>
            <textarea
              rows={4}
              {...register('description')}
              placeholder="Mô tả chi tiết quyền lợi của voucher, chính sách áp dụng hoặc các món trong buffet..."
              className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {/* CẤU HÌNH GIÁ VÀ HẠN DÙNG */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5 border-b border-border pb-3">
            <DollarSign className="h-4 w-4" />
            Cấu hình Giá bán & Thời gian áp dụng
          </h3>

          {/* THIẾT LẬP GIÁ */}
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              {...register('hasDiscount')}
              onChange={(event) => {
                setValue('hasDiscount', event.target.checked, {
                  shouldValidate: true,
                });
                if (!event.target.checked) {
                  setValue('salePrice', '', { shouldValidate: true });
                }
              }}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            Áp dụng giá khuyến mãi
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Giá bán lẻ gốc (Retail Price)
              </label>
              <input
                type="number"
                {...register('originalPrice')}
                placeholder="Ví dụ: 100000"
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.originalPrice && (
                <p className="mt-1 text-xs text-primary">{errors.originalPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Giá khuyến mãi bán ra (Sale Price - RB-02)
              </label>
              <input
                type="number"
                {...register('salePrice')}
                disabled={!hasDiscountSelected}
                placeholder="Ví dụ: 70000"
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted"
              />
              {errors.salePrice && (
                <p className="mt-1 text-xs text-primary">{errors.salePrice.message}</p>
              )}
            </div>
          </div>

          {/* THỜI GIAN MỞ BÁN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Thời gian bắt đầu mở bán
              </label>
              <input
                type="datetime-local"
                {...register('saleStartTime')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.saleStartTime && (
                <p className="mt-1 text-xs text-primary">{errors.saleStartTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Thời gian kết thúc mở bán (RB-03)
              </label>
              <input
                type="datetime-local"
                {...register('saleEndTime')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.saleEndTime && (
                <p className="mt-1 text-xs text-primary">{errors.saleEndTime.message}</p>
              )}
            </div>
          </div>

          {/* THỜI GIAN SỬ DỤNG VOUCHER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Hạn bắt đầu sử dụng mã
              </label>
              <input
                type="datetime-local"
                {...register('usageStartTime')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.usageStartTime && (
                <p className="mt-1 text-xs text-primary">{errors.usageStartTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Hạn kết thúc sử dụng mã
              </label>
              <input
                type="datetime-local"
                {...register('usageEndTime')}
                className="block w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.usageEndTime && (
                <p className="mt-1 text-xs text-primary">{errors.usageEndTime.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* CHỌN CHI NHÁNH & CHẾ ĐỘ QUÉT */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5 border-b border-border pb-3">
            <MapPin className="h-4 w-4" />
            Chi nhánh áp dụng & Chế độ sử dụng
          </h3>

          {/* DANH SÁCH CHI NHÁNH CHỌN (RB-09) */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              Lựa chọn chi nhánh áp dụng quét mã (Ít nhất 1 chi nhánh)
            </label>
            {loadingBranches ? (
              <div className="py-4 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : branches.length === 0 ? (
              <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200 text-yellow-800 text-xs">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="h-4 w-4 shrink-0 text-yellow-600" />
                  Bạn chưa tạo chi nhánh nào! 
                </p>
                <p className="mt-1 text-[11px]">
                  Vui lòng truy cập trang <Link href="/partner/branches" className="font-bold underline text-primary">Chi nhánh cửa hàng</Link> để tạo trước khi khởi tạo voucher.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-border/60 bg-slate-50/50 p-3 rounded-lg">
                {branches.map((branch) => (
                  <label key={branch.branchId} className="relative flex items-start p-2 rounded-lg bg-card border border-border hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex h-5 items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        onChange={(e) => handleBranchCheckboxChange(branch.branchId, e.target.checked)}
                      />
                    </div>
                    <div className="ml-3 text-xs leading-5">
                      <span className="font-semibold text-foreground">{branch.name}</span>
                      <p className="text-[10px] text-muted line-clamp-1">{branch.address}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.branchIds && (
              <p className="mt-1.5 text-xs text-primary">{errors.branchIds.message}</p>
            )}
          </div>

          {/* CẤU HÌNH QUÉT NHIỀU LẦN */}
          <div className="pt-4 border-t border-border/60 space-y-4">
            <label className="relative flex items-start cursor-pointer">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  {...multiUseRegistration}
                  onChange={(event) => {
                    void multiUseRegistration.onChange(event);
                    if (!event.target.checked) {
                      setValue('maxUsesPerCode', '');
                    }
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
              </div>
              <div className="ml-3 text-xs leading-5">
                <span className="font-semibold text-foreground">Sử dụng nhiều lần</span>
                <p className="text-[10px] text-muted">Voucher có thể quét quy đổi nhiều lần (vd: gói tập, buffet dài ngày)</p>
              </div>
            </label>

            {isMultiUseSelected && (
              <div className="pl-7 max-w-xs animate-in slide-in-from-top-2 duration-200">
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Số lần quét/sử dụng tối đa
                </label>
                <input
                  type="number"
                  {...register('maxUsesPerCode')}
                  placeholder="Ví dụ: 5"
                  className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                {errors.maxUsesPerCode && (
                  <p className="mt-1 text-xs text-primary">{errors.maxUsesPerCode.message}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* NÚT TÁC VỤ */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/partner/vouchers"
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/40 transition-all"
          >
            Hủy bỏ
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-primary py-2.5 px-6 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-all shadow-sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Đang tạo...' : 'Tạo chiến dịch Nháp'}
          </button>
        </div>

      </form>

    </div>
  );
}

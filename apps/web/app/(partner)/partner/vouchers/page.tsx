'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { hasDiscount, resolveSellingPrice } from '../../../../lib/pricing';
import Link from 'next/link';
import { Ticket, Plus, Send, AlertCircle, CheckCircle, Clock3, Calendar, MapPin } from 'lucide-react';
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

interface Branch {
  branchId: string;
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number | null;
  capacity: number;
  soldQuantity: number;
  reservedStock: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'EXPIRED' | 'SOLD_OUT';
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  campaignBranches: CampaignBranch[];
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function PartnerVouchersPage() {
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [campaignToSubmit, setCampaignToSubmit] = useState<VoucherCampaign | null>(null);

  const loadCampaigns = async () => {
    try {
      const data = await apiRequest<VoucherCampaign[]>('/vouchers/partner/list');
      setCampaigns(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chiến dịch.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCampaigns();
    });
  }, []);

  const handleSubmitForApproval = async (campaignId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest<void>(`/vouchers/${campaignId}/submit`, {
        method: 'POST',
      });
      setSuccessMsg('Gửi yêu cầu phê duyệt voucher thành công!');
      loadCampaigns();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Gửi yêu cầu phê duyệt thất bại.'));
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chiến dịch Voucher</h1>
          <p className="mt-1.5 text-sm text-muted">
            Danh sách các chương trình khuyến mãi và trạng thái phê duyệt từ hệ thống
          </p>
        </div>
        <Link
          href="/partner/vouchers/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tạo Voucher mới
        </Link>
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

      {/* DANH SÁCH CAMPAIGNS */}
      {campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
          <Ticket className="h-10 w-10 text-muted/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Chưa có chiến dịch nào</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Khởi tạo chiến dịch voucher đầu tiên của bạn để gửi yêu cầu kiểm duyệt lên Admin trước khi đăng bán công khai.
          </p>
          <Link
            href="/partner/vouchers/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-secondary py-2 px-4 text-xs font-semibold text-primary hover:bg-secondary/70 transition-colors"
          >
            Tạo chiến dịch nháp ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <div
              key={campaign.campaignId}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div>
                {/* Header card: Title & status */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-bold text-foreground line-clamp-1" title={campaign.title}>
                    {campaign.title}
                  </h3>
                  
                  {campaign.status === 'DRAFT' && (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-600/10">
                      Nháp
                    </span>
                  )}
                  {campaign.status === 'PENDING_APPROVAL' && (
                    <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                      Chờ duyệt
                    </span>
                  )}
                  {campaign.status === 'APPROVED' && (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-800 ring-1 ring-inset ring-green-600/20">
                      Hoạt động
                    </span>
                  )}
                  {campaign.status === 'REJECTED' && (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-600/20">
                      Từ chối
                    </span>
                  )}
                </div>

                {/* Sub: Category */}
                <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-md px-1.5 py-0.5">
                  {campaign.category || 'Ẩm thực'}
                </span>

                {/* Prices & Stock */}
                <div className="mt-4 grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-muted block">Giá bán / Giá gốc</span>
                    <span className="font-bold text-foreground text-sm">
                      {resolveSellingPrice(campaign).toLocaleString('vi-VN')} đ
                    </span>
                    {hasDiscount(campaign) ? (
                      <span className="text-muted text-[10px] line-through ml-1.5">
                        {Number(campaign.originalPrice).toLocaleString('vi-VN')} đ
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-muted block">Kho (Bán/Sức chứa)</span>
                    <span className="font-bold text-foreground">
                      {campaign.soldQuantity} / {campaign.capacity}
                    </span>
                    {(campaign.reservedStock > 0) && (
                      <span className="text-yellow-600 text-[10px] ml-1.5">
                        ({campaign.reservedStock} tạm giữ)
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates & Branches */}
                <div className="mt-4 space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 shrink-0 text-muted/80" />
                    <span>
                      Thời gian bán: {formatDateTime(campaign.saleStartTime)} - {formatDateTime(campaign.saleEndTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 shrink-0 text-muted/80" />
                    <span>
                      Thời gian sử dụng: {formatDateTime(campaign.usageStartTime)} - {formatDateTime(campaign.usageEndTime)}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-muted/80 mt-0.5" />
                    <div className="line-clamp-1" title={campaign.campaignBranches.map((cb) => cb.branch.name).join(', ')}>
                      Chi nhánh áp dụng: {campaign.campaignBranches.map((cb) => cb.branch.name).join(', ')}
                    </div>
                  </div>
                </div>
              </div>

              {/* HÀNH ĐỘNG DƯỚI CÙNG CARD */}
              {(campaign.status === 'DRAFT' || campaign.status === 'REJECTED') && (
                <div className="mt-5 border-t border-border/60 pt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setCampaignToSubmit(campaign)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Gửi duyệt
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(campaignToSubmit)}
        onOpenChange={(open) => {
          if (!open) setCampaignToSubmit(null);
        }}
      >
        {campaignToSubmit && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Gửi duyệt chiến dịch &quot;{campaignToSubmit.title}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sau khi gửi, chiến dịch sẽ chuyển sang trạng thái chờ Admin phê duyệt và bạn
                không thể tự ý chỉnh sửa cho đến khi có kết quả.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
              <AlertDialogAction
                variant="default"
                onClick={() => void handleSubmitForApproval(campaignToSubmit.campaignId)}
              >
                Gửi yêu cầu phê duyệt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

    </div>
  );
}

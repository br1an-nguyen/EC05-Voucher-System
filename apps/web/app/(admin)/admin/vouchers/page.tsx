'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { Ticket, Check, X, AlertCircle, CheckCircle, Calendar, MapPin, Building, Clock } from 'lucide-react';

interface Branch {
  branchId: string;
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface Partner {
  companyName: string;
  representative: string | null;
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  description: string | null;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  partner: Partner;
  campaignBranches: CampaignBranch[];
}

export default function AdminVouchersApprovalPage() {
  const [pendingCampaigns, setPendingCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPendingCampaigns = async () => {
    try {
      const data = await apiRequest('/vouchers/admin/pending');
      setPendingCampaigns(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách voucher chờ duyệt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingCampaigns();
  }, []);

  const handleApprove = async (campaignId: string) => {
    if (!confirm('Xác nhận PHÊ DUYỆT chiến dịch voucher này hoạt động và cho phép khách hàng mua?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest(`/vouchers/admin/${campaignId}/approve`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã phê duyệt chiến dịch voucher thành công!');
      loadPendingCampaigns();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi phê duyệt chiến dịch.');
    }
  };

  const handleReject = async (campaignId: string) => {
    if (!confirm('Xác nhận TỪ CHỐI chiến dịch voucher này?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest(`/vouchers/admin/${campaignId}/reject`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã từ chối chiến dịch voucher thành công.');
      loadPendingCampaigns();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi từ chối chiến dịch.');
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
      
      {/* TIÊU ĐỀ */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Phê duyệt Chiến dịch Voucher</h1>
        <p className="mt-1.5 text-sm text-muted">
          Xét duyệt nội dung, điều khoản và định giá của các chiến dịch voucher do đối tác gửi lên trước khi đăng bán công khai
        </p>
      </div>

      {/* THÔNG BÁO DẠNG TOAST */}
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

      {/* DANH SÁCH VOUCHER CHỜ DUYỆT */}
      {pendingCampaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
          <Ticket className="h-10 w-10 text-muted/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Không có voucher nào đang chờ duyệt</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Hộp thư phê duyệt sạch sẽ! Hiện tại không ghi nhận chiến dịch khuyến mãi nào được gửi lên chờ kiểm duyệt.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {pendingCampaigns.map((campaign) => (
            <div
              key={campaign.campaignId}
              className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between gap-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Thông tin voucher */}
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-start gap-3">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/5 rounded-md px-2 py-0.5 mt-1 shrink-0">
                      {campaign.category || 'Ẩm thực'}
                    </span>
                    <h3 className="text-lg font-bold text-foreground leading-snug">{campaign.title}</h3>
                  </div>
                  {campaign.description && (
                    <p className="text-xs text-muted leading-relaxed line-clamp-3 bg-slate-50 border border-slate-100 p-3 rounded-lg">
                      {campaign.description}
                    </p>
                  )}
                  
                  {/* Danh sách chi nhánh */}
                  <div className="flex items-start gap-2 text-xs text-muted pt-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Chi nhánh áp dụng: </span>
                      {campaign.campaignBranches.map(cb => cb.branch.name).join(', ')}
                    </div>
                  </div>
                </div>

                {/* 2. Cấu hình định giá & thông tin đối tác */}
                <div className="space-y-4 lg:border-l lg:border-border lg:pl-6 text-xs">
                  
                  {/* Đối tác gửi */}
                  <div className="space-y-1.5">
                    <span className="text-muted block uppercase tracking-wider text-[10px] font-semibold">Đối tác gửi yêu cầu</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Building className="h-4 w-4 text-muted shrink-0" />
                      <span>{campaign.partner.companyName}</span>
                    </div>
                    {campaign.partner.representative && (
                      <div className="text-muted pl-5 text-[11px]">ĐD: {campaign.partner.representative}</div>
                    )}
                  </div>

                  {/* Định giá */}
                  <div className="space-y-1.5 pt-2 border-t border-border/60">
                    <span className="text-muted block uppercase tracking-wider text-[10px] font-semibold">Định giá & Số lượng</span>
                    <div>
                      Giá bán: <span className="font-bold text-foreground text-sm">{Number(campaign.salePrice).toLocaleString('vi-VN')} đ</span>
                      <span className="text-muted text-[10px] line-through ml-1.5">({Number(campaign.originalPrice).toLocaleString('vi-VN')} đ)</span>
                    </div>
                    <div>Số lượng phát hành: <span className="font-bold text-foreground">{campaign.capacity} chiếc</span></div>
                  </div>

                  {/* Thời gian */}
                  <div className="space-y-1.5 pt-2 border-t border-border/60 text-muted">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Mở bán: {new Date(campaign.saleStartTime).toLocaleDateString('vi-VN')} - {new Date(campaign.saleEndTime).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Sử dụng: {new Date(campaign.usageStartTime).toLocaleDateString('vi-VN')} - {new Date(campaign.usageEndTime).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* HÀNH ĐỘNG DUYỆT / TỪ CHỐI */}
              <div className="border-t border-border/60 pt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => handleReject(campaign.campaignId)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-border text-foreground hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Từ chối
                </button>
                <button
                  onClick={() => handleApprove(campaign.campaignId)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  Phê duyệt đăng tải
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Ticket, 
  Search, 
  Calendar, 
  MapPin, 
  QrCode, 
  CheckCircle, 
  Clock, 
  X,
  AlertCircle,
  Copy,
  ChevronRight
} from 'lucide-react';

interface Branch {
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface Partner {
  companyName: string;
}

interface VoucherCampaign {
  title: string;
  usageEndTime: string;
  partner: Partner;
  campaignBranches: CampaignBranch[];
}

interface OrderItem {
  campaign: VoucherCampaign;
}

interface VoucherCode {
  codeId: string;
  itemId: string;
  uniqueCode: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  issuedAt: string;
  orderItem: OrderItem;
}

interface GroupedVoucher {
  key: string;
  campaign: VoucherCampaign;
  items: VoucherCode[];
  representativeCode: string;
}

export default function CustomerVouchersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Navigation tab: 'AVAILABLE' | 'USED' | 'EXPIRED'
  const [activeTab, setActiveTab] = useState<'AVAILABLE' | 'USED' | 'EXPIRED'>('AVAILABLE');
  
  // Selected QR Code modal state
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherCode | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchWallet = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest('/vouchers/customer/wallet');
      setVouchers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải ví voucher của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/customer/vouchers');
      } else {
        fetchWallet();
      }
    }
  }, [user, authLoading]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const groupVouchers = (list: VoucherCode[]) => {
    const groupedMap = new Map<string, GroupedVoucher>();

    for (const voucher of list) {
      const campaign = voucher.orderItem.campaign;
      const key = `${campaign.partner.companyName}::${campaign.title}::${campaign.usageEndTime}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          key,
          campaign,
          items: [],
          representativeCode: voucher.uniqueCode,
        });
      }

      groupedMap.get(key)!.items.push(voucher);
    }

    return Array.from(groupedMap.values()).map((group) => ({
      ...group,
      representativeCode: group.items[0]?.uniqueCode || group.representativeCode,
    }));
  };

  // Filter vouchers based on current active tab
  const filteredVouchers = vouchers.filter((v) => {
    if (activeTab === 'AVAILABLE') return v.status === 'AVAILABLE';
    if (activeTab === 'USED') return v.status === 'USED';
    // EXPIRED or CANCELLED tabs
    return v.status === 'EXPIRED' || v.status === 'CANCELLED';
  });

  const groupedVouchers = groupVouchers(filteredVouchers);

  return (
    <div className="min-h-screen bg-background font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-primary font-semibold transition-colors">Trang chủ</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Ví Voucher của tôi</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">Ví Voucher cá nhân</h1>
              <p className="text-xs text-muted">Quản lý và sử dụng các mã giảm giá bạn đã mua thành công.</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TABS ĐIỀU HƯỚNG */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('AVAILABLE')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'AVAILABLE'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            Chưa sử dụng ({groupVouchers(vouchers.filter((v) => v.status === 'AVAILABLE')).length})
          </button>
          <button
            onClick={() => setActiveTab('USED')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'USED'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            Đã sử dụng ({groupVouchers(vouchers.filter((v) => v.status === 'USED')).length})
          </button>
          <button
            onClick={() => setActiveTab('EXPIRED')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'EXPIRED'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            Lịch sử khác ({groupVouchers(vouchers.filter((v) => v.status === 'EXPIRED' || v.status === 'CANCELLED')).length})
          </button>
        </div>

        {/* DANH SÁCH VOUCHER */}
        {groupedVouchers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Ticket className="h-10 w-10 text-muted mx-auto" />
            <h3 className="text-sm font-bold text-foreground">Không tìm thấy voucher nào</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {activeTab === 'AVAILABLE' 
                ? 'Bạn không có mã voucher nào chưa sử dụng. Hãy truy cập trang chủ để tìm kiếm khuyến mãi hấp dẫn!'
                : 'Lịch sử ví voucher của bạn hiện đang trống.'}
            </p>
            {activeTab === 'AVAILABLE' && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold transition-colors mt-2"
              >
                Mua sắm ngay
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedVouchers.map((group) => {
              const voucher = group.items[0];
              const campaign = group.campaign;
              const formattedDate = new Date(campaign.usageEndTime).toLocaleDateString('vi-VN');
              const status = voucher.status;

              return (
                <div 
                  key={group.key}
                  className={`rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-4 shadow-sm relative overflow-hidden transition-all ${
                    status === 'AVAILABLE' ? 'hover:shadow-md' : 'opacity-70'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Partner & Status */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {campaign.partner.companyName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          x{group.items.length}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-700'
                            : status === 'USED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {status === 'AVAILABLE' ? 'Chưa dùng' : status === 'USED' ? 'Đã dùng' : status === 'EXPIRED' ? 'Hết hạn' : 'Đã hủy'}
                        </span>
                      </div>
                    </div>

                    {/* Voucher Title */}
                    <h3 className="font-extrabold text-foreground text-sm sm:text-base line-clamp-2">
                      {campaign.title}
                    </h3>

                    {/* Applicable branches */}
                    <div className="flex items-start gap-1.5 text-xs text-muted pt-1">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="line-clamp-1">
                        Áp dụng tại: {campaign.campaignBranches.map(cb => cb.branch.name).join(', ')}
                      </span>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Hạn sử dụng: <span className="font-bold text-foreground">{formattedDate}</span></span>
                    </div>
                  </div>

                  {/* Actions & Code String */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/40">
                    <div className="bg-secondary/60 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-foreground tracking-wider flex items-center gap-2">
                      <span>{group.representativeCode}</span>
                      <button 
                        onClick={() => handleCopyCode(group.representativeCode)}
                        className="text-muted hover:text-primary transition-colors"
                        title="Sao chép mã"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {status === 'AVAILABLE' && (
                      <button
                        onClick={() => setSelectedVoucher(group.items[0])}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm shadow-primary/10"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Quét mã QR
                      </button>
                    )}
                  </div>
                  
                  {copiedCode && (
                    <div className="absolute bottom-4 right-4 bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg animate-fade-in-up">
                      Đã sao chép!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL HIỂN THỊ QR CODE ĐỂ QUÉT REDEEM */}
        {selectedVoucher && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl text-center space-y-6 animate-scale-up">
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedVoucher(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary text-muted hover:text-foreground transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-extrabold text-primary bg-primary/5 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {selectedVoucher.orderItem.campaign.partner.companyName}
                </span>
                <h3 className="font-extrabold text-foreground text-sm leading-snug line-clamp-2 px-4 pt-1">
                  {selectedVoucher.orderItem.campaign.title}
                </h3>
              </div>

              {/* QR Image Container */}
              <div className="bg-white border-2 border-border p-4 rounded-2xl inline-block mx-auto shadow-inner relative group">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedVoucher.uniqueCode}`}
                  alt="Voucher QR Code"
                  width={200}
                  height={200}
                  className="mx-auto"
                />
              </div>

              {/* Unique Code Display */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-secondary/80 rounded-xl px-4 py-2 font-mono text-sm font-black text-foreground tracking-widest shadow-sm">
                  <span>{selectedVoucher.uniqueCode}</span>
                  <button
                    onClick={() => handleCopyCode(selectedVoucher.uniqueCode)}
                    className="text-muted hover:text-primary transition-colors"
                    title="Sao chép mã"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                
                <p className="text-[10px] text-muted max-w-xs mx-auto leading-relaxed px-4">
                  Đưa mã QR này hoặc cung cấp chuỗi ký tự trên cho nhân viên chi nhánh áp dụng tại quầy thu ngân để tiến hành xác thực quét đổi voucher.
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

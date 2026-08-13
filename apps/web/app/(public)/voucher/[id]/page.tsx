'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import Link from 'next/link';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Store, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle,
  Ticket,
  ChevronRight,
  Info
} from 'lucide-react';

interface Branch {
  branchId: string;
  name: string;
  address: string | null;
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
  soldQuantity: number;
  reservedStock: number;
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  isMultiUse: boolean;
  maxUsesPerCode: number | null;
  partner: Partner;
  campaignBranches: CampaignBranch[];
}

export default function VoucherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<VoucherCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaign() {
      try {
        const data = await apiRequest(`/vouchers/${campaignId}`);
        setCampaign(data);
      } catch (err: any) {
        setErrorMsg(err.message || 'Không thể tải thông tin chi tiết voucher.');
      } finally {
        setLoading(false);
      }
    }
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  const handlePurchaseClick = () => {
    if (!user) {
      // Điều hướng về trang login nếu chưa đăng nhập
      router.push('/login');
      return;
    }

    // Thông báo Mock vì tính năng Cart/Checkout sẽ được triển khai ở Commit 10 & 11
    setDemoMessage(`Thành công! Chức năng mua ${purchaseQty} voucher sẽ khả dụng ở Commit 10 & 11 (Giỏ hàng và Thanh toán) tiếp theo.`);
    setTimeout(() => setDemoMessage(null), 6000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (errorMsg || !campaign) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-primary mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Không tìm thấy voucher</h3>
        <p className="text-sm text-muted">{errorMsg || 'Chiến dịch voucher này không tồn tại hoặc đã bị gỡ bỏ.'}</p>
        <Link href="/" className="inline-flex items-center text-xs font-bold text-primary hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const remaining = campaign.capacity - campaign.soldQuantity;
  const isSoldOut = remaining <= 0;
  const discountPct = Math.round(((Number(campaign.originalPrice) - Number(campaign.salePrice)) / Number(campaign.originalPrice)) * 100);

  return (
    <div className="min-h-screen bg-background font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* THANH BREADCRUMB / QUAY LẠI */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-primary font-semibold transition-colors">Trang chủ</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground max-w-xs truncate">{campaign.title}</span>
        </div>

        {/* THÔNG BÁO DEMO MUA HÀNG */}
        {demoMessage && (
          <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-4 border border-green-500/20 text-green-800 text-sm leading-relaxed animate-in slide-in-from-top-2">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
            <p className="font-semibold">{demoMessage}</p>
          </div>
        )}

        {/* CONTAINER CHÍNH */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* CỘT TRÁI: CHI TIẾT VOUCHER */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
              
              {/* Badge & Title */}
              <div>
                <span className="inline-block text-[10px] font-bold text-primary bg-primary/5 rounded px-2 py-0.5 uppercase tracking-wide">
                  {campaign.category || 'Ẩm thực'}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-2 leading-tight">
                  {campaign.title}
                </h1>
                
                <div className="flex items-center gap-1.5 text-xs text-muted mt-2">
                  <Store className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">{campaign.partner.companyName}</span>
                </div>
              </div>

              {/* Mô tả & Quy chế */}
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Mô tả chương trình & Điều kiện áp dụng</h3>
                <div className="text-xs text-muted leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  {campaign.description || 'Không có mô tả chi tiết cho chương trình khuyến mãi này.'}
                </div>
              </div>

              {/* Quy chế quét */}
              <div className="border-t border-border pt-4 text-xs space-y-2">
                <h3 className="text-sm font-bold text-foreground">Hình thức quy đổi</h3>
                <div className="flex items-center gap-2 text-muted">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span>
                    Chế độ quét mã: {campaign.isMultiUse 
                      ? `Sử dụng nhiều lần (Tối đa ${campaign.maxUsesPerCode || 'không giới hạn'} lần quét)` 
                      : 'Quét 1 lần duy nhất để đổi voucher'
                    }
                  </span>
                </div>
              </div>

              {/* Chi nhánh áp dụng */}
              <div className="border-t border-border pt-4 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-foreground">Chi nhánh áp dụng ({campaign.campaignBranches.length})</h3>
                <div className="grid grid-cols-1 gap-3">
                  {campaign.campaignBranches.map((cb) => (
                    <div key={cb.branch.branchId} className="flex gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-foreground">{cb.branch.name}</div>
                        <p className="text-[11px] text-muted mt-0.5">{cb.branch.address || 'Chưa cập nhật địa chỉ'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* CỘT PHẢI: KHUNG ĐẶT MUA */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-24 space-y-6">
              
              {/* Giá cả */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Giá khuyến mãi</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-primary">
                    {Number(campaign.salePrice).toLocaleString('vi-VN')} đ
                  </span>
                  <span className="text-xs text-muted line-through">
                    {Number(campaign.originalPrice).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                {discountPct > 0 && (
                  <span className="inline-block text-[10px] font-bold text-red-700 bg-red-50 rounded px-1.5 py-0.5 ring-1 ring-red-600/10 mt-1">
                    Tiết kiệm {discountPct}% ({Math.round(Number(campaign.originalPrice) - Number(campaign.salePrice)).toLocaleString('vi-VN')} đ)
                  </span>
                )}
              </div>

              {/* Tình trạng kho hàng */}
              <div className="border-t border-border/60 pt-4 text-xs space-y-2 text-muted">
                <div className="flex items-center justify-between">
                  <span>Tình trạng:</span>
                  <span className={`font-bold ${isSoldOut ? 'text-red-600' : 'text-green-600'}`}>
                    {isSoldOut ? 'Hết hàng' : 'Đang mở bán'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Còn lại trong kho:</span>
                  <span className="font-bold text-foreground">{remaining} / {campaign.capacity} voucher</span>
                </div>
              </div>

              {/* Hạn sử dụng */}
              <div className="border-t border-border/60 pt-4 text-xs space-y-2 text-muted">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>Bán đến: {new Date(campaign.saleEndTime).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span>Sử dụng đến: {new Date(campaign.usageEndTime).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              {/* Bộ chọn số lượng (nếu chưa hết hàng) */}
              {!isSoldOut && (
                <div className="border-t border-border/60 pt-4 space-y-2">
                  <label className="block text-xs font-semibold text-foreground">Chọn số lượng mua</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={purchaseQty <= 1}
                      onClick={() => setPurchaseQty(purchaseQty - 1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="h-8 w-12 border border-border rounded-lg flex items-center justify-center text-xs font-bold text-foreground bg-slate-50/50">
                      {purchaseQty}
                    </span>
                    <button
                      type="button"
                      disabled={purchaseQty >= Math.min(remaining, 10)}
                      onClick={() => setPurchaseQty(purchaseQty + 1)}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50"
                    >
                      +
                    </button>
                    <span className="text-[10px] text-muted ml-1">(Tối đa 10)</span>
                  </div>
                </div>
              )}

              {/* Đăng nhập nhắc nhở */}
              {!user && (
                <div className="rounded-lg bg-yellow-50 p-3 border border-yellow-100 flex items-start gap-2 text-[10px] text-yellow-800">
                  <Info className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <span>Bạn cần đăng nhập tài khoản Khách hàng để thực hiện giao dịch mua voucher.</span>
                </div>
              )}

              {/* Nút Đặt mua */}
              <button
                type="button"
                onClick={handlePurchaseClick}
                disabled={isSoldOut}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold disabled:bg-slate-300 disabled:text-slate-500 transition-colors shadow shadow-primary/10"
              >
                <ShoppingCart className="h-4 w-4" />
                {isSoldOut ? 'Đã hết hàng' : user ? 'Mua Voucher ngay' : 'Đăng nhập để mua'}
              </button>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

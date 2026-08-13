'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  QrCode, 
  Store, 
  CheckCircle, 
  XCircle, 
  Info,
  Calendar,
  Ticket,
  ChevronRight,
  User,
  ShieldCheck
} from 'lucide-react';

interface Branch {
  branchId: string;
  name: string;
}

export default function PartnerRedeemPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Form input states
  const [uniqueCode, setUniqueCode] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Result state after scanning
  const [redeemResult, setRedeemResult] = useState<any | null>(null);

  // Lấy danh sách chi nhánh để hiển thị trong bộ chọn
  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const data = await apiRequest('/partners/branches');
      setBranches(data);
      if (data.length > 0) {
        // Tự động chọn chi nhánh đầu tiên hoặc chi nhánh được gán cho nhân viên (nếu có)
        const staffBranchId = user?.branchId;
        if (staffBranchId) {
          setSelectedBranchId(staffBranchId);
        } else {
          setSelectedBranchId(data[0].branchId);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách chi nhánh.');
    } finally {
      setLoadingBranches(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== 'PARTNER' && user.role !== 'PARTNER_STAFF' && user.role !== 'ADMIN')) {
        router.push('/login?redirect=/partner/redeem');
      } else {
        loadBranches();
      }
    }
  }, [user, authLoading]);

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniqueCode.trim()) {
      setErrorMsg('Vui lòng nhập chuỗi mã voucher.');
      return;
    }
    if (!selectedBranchId) {
      setErrorMsg('Vui lòng chọn chi nhánh thực hiện quét.');
      return;
    }

    setRedeeming(true);
    setErrorMsg(null);
    setRedeemResult(null);

    try {
      const result = await apiRequest('/vouchers/redeem', {
        method: 'POST',
        body: JSON.stringify({
          uniqueCode: uniqueCode.trim().toUpperCase(),
          branchId: selectedBranchId,
        }),
      });
      setRedeemResult(result);
      setUniqueCode(''); // Reset input code after successful verification
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã voucher không hợp lệ hoặc không thể sử dụng.');
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || loadingBranches) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  // Khóa lựa chọn chi nhánh nếu tài khoản là Staff và đã được gán sẵn chi nhánh
  const isBranchSelectDisabled = user?.role === 'PARTNER_STAFF' && !!user?.branchId;

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Đối tác</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Xác thực quét mã</span>
      </div>

      <div className="pb-4 border-b border-border/60">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
          <QrCode className="h-6 w-6 text-primary" />
          Quét & Đổi mã Voucher
        </h1>
        <p className="text-xs text-muted mt-1">Xác thực mã voucher khách hàng cung cấp và tiến hành ghi nhận đổi voucher tại quầy.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI: Ô NHẬP & CHỌN CHI NHÁNH (2 CỘT) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <form onSubmit={handleRedeemSubmit} className="space-y-4">
              
              {/* CHI NHÁNH QUÉT */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Chi nhánh thực hiện quét mã
                </label>
                <div className="relative">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={isBranchSelectDisabled}
                    className="block w-full rounded-lg border border-border bg-card py-2.5 px-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm appearance-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                  >
                    {branches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <Store className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {isBranchSelectDisabled && (
                  <p className="text-[10px] text-muted">Tài khoản nhân viên được khóa cố định theo chi nhánh được phân công.</p>
                )}
              </div>

              {/* MÃ VOUCHER */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Mã Voucher (12 ký tự)
                </label>
                <input
                  type="text"
                  value={uniqueCode}
                  onChange={(e) => setUniqueCode(e.target.value)}
                  placeholder="Ví dụ: A1B2C3D4E5F6"
                  maxLength={12}
                  className="block w-full rounded-lg border border-border bg-card py-2.5 px-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono tracking-widest uppercase transition-all"
                />
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={redeeming}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold disabled:bg-slate-300 transition-all shadow shadow-primary/10"
              >
                {redeeming ? 'Đang xác thực...' : 'Xác thực & Áp dụng'}
              </button>

            </form>
          </div>

          {/* KẾT QUẢ ĐỔI MÃ THÀNH CÔNG */}
          {redeemResult && (
            <div className="rounded-2xl border border-green-200 bg-green-500/5 p-6 space-y-4 animate-scale-up">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-green-800">Đổi voucher thành công!</h3>
                  <p className="text-[11px] text-green-600">Giao dịch sử dụng đã được ghi nhận trên hệ thống lúc {new Date(redeemResult.usedAt).toLocaleTimeString('vi-VN')}.</p>
                </div>
              </div>

              <div className="border-t border-green-200/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block">Mã giao dịch quét:</span>
                  <span className="font-bold text-foreground mt-0.5 block">#{redeemResult.usageId.substring(0, 8).toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-muted block">Chi nhánh áp dụng:</span>
                  <span className="font-bold text-foreground mt-0.5 block">{redeemResult.branch.name}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* CỘT PHẢI: QUY CHUẨN XÁC THỰC (1 CỘT) */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Quy chuẩn quét mã
            </h3>
            
            <div className="space-y-3 text-xs text-muted leading-relaxed">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Yêu cầu khách hàng trình mã QR trực tiếp trên màn hình điện thoại hoặc cung cấp mã ký tự in trên phiếu.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Kiểm tra chính xác địa điểm chi nhánh quét trùng khớp với chi nhánh được khách hàng chọn.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Mỗi mã voucher sau khi quét thành công sẽ tự động cập nhật trạng thái đã dùng trên tài khoản của khách hàng và không thể quét lại.</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

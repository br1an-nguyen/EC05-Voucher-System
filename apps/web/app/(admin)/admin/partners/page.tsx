'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { Users, Check, X, AlertCircle, CheckCircle, Search, Mail, Phone } from 'lucide-react';
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

interface Partner {
  partnerId: string;
  companyName: string;
  taxCode: string;
  representative: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'LOCKED';
  createdAt: string;
  user: {
    email: string | null;
    phone: string | null;
    fullName: string | null;
    status: string;
  };
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerAction, setPartnerAction] = useState<{
    partner: Partner;
    type: 'approve' | 'reject';
  } | null>(null);

  const loadPartners = async () => {
    try {
      const data = await apiRequest<Partner[]>('/partners/admin/list');
      setPartners(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách đối tác.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadPartners();
    });
  }, []);

  const handleApprove = async (partnerId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest<void>(`/partners/admin/${partnerId}/approve`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã phê duyệt đối tác và kích hoạt tài khoản thành công!');
      loadPartners();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi duyệt đối tác.'));
    }
  };

  const handleReject = async (partnerId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiRequest<void>(`/partners/admin/${partnerId}/reject`, {
        method: 'PATCH',
      });
      setSuccessMsg('Đã từ chối đối tác thành công.');
      loadPartners();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Lỗi xảy ra khi từ chối đối tác.'));
    }
  };

  const filteredPartners = partners.filter(p => 
    p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.taxCode.includes(searchTerm) ||
    (p.representative && p.representative.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Duyệt Đối tác Đăng ký</h1>
        <p className="mt-1.5 text-sm text-muted">
          Xét duyệt hồ sơ pháp nhân doanh nghiệp đối tác trước khi cho phép đăng bán voucher
        </p>
      </div>

      {/* THÔNG BÁO */}
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

      {/* THANH TÌM KIẾM */}
      <div className="flex rounded-lg shadow-sm max-w-md bg-card border border-border">
        <div className="relative flex flex-grow items-stretch focus-within:z-10">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-muted" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border-0 bg-transparent py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none placeholder-slate-400"
            placeholder="Tìm theo tên công ty, mã số thuế, đại diện..."
          />
        </div>
      </div>

      {/* BẢNG DANH SÁCH ĐỐI TÁC */}
      {filteredPartners.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
          <Users className="h-10 w-10 text-muted/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Không tìm thấy đối tác</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Hệ thống hiện tại chưa ghi nhận yêu cầu đăng ký đối tác nào khớp với thông tin tìm kiếm của bạn.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Tên Doanh nghiệp</th>
                  <th className="px-6 py-4">Mã số thuế / Đại diện</th>
                  <th className="px-6 py-4">Tài khoản Liên hệ</th>
                  <th className="px-6 py-4">Trạng thái duyệt</th>
                  <th className="px-6 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPartners.map((partner) => (
                  <tr key={partner.partnerId} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Tên Doanh nghiệp */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground">{partner.companyName}</div>
                      <div className="text-[10px] text-muted mt-0.5">
                        Ngày tạo: {new Date(partner.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    {/* MST / Người đại diện */}
                    <td className="px-6 py-4">
                      <div className="text-foreground font-semibold">MST: {partner.taxCode}</div>
                      <div className="text-xs text-muted mt-0.5">ĐD: {partner.representative || 'Chưa rõ'}</div>
                    </td>

                    {/* Tài khoản đăng ký */}
                    <td className="px-6 py-4">
                      <div className="text-xs text-foreground font-medium flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span>{partner.user.email || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span>{partner.user.phone || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Trạng thái duyệt */}
                    <td className="px-6 py-4">
                      {partner.approvalStatus === 'PENDING' && (
                        <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                          Chờ xét duyệt
                        </span>
                      )}
                      {partner.approvalStatus === 'APPROVED' && (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-800 ring-1 ring-inset ring-green-600/20">
                          Đã hoạt động
                        </span>
                      )}
                      {partner.approvalStatus === 'REJECTED' && (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-600/20">
                          Đã từ chối
                        </span>
                      )}
                    </td>

                    {/* Hành động phê duyệt */}
                    <td className="px-6 py-4 text-right">
                      {partner.approvalStatus === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPartnerAction({ partner, type: 'approve' })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                            title="Phê duyệt"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Duyệt
                          </button>
                          <button
                            onClick={() => setPartnerAction({ partner, type: 'reject' })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            title="Từ chối"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted/60 italic font-medium">Đã xử lý</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(partnerAction)}
        onOpenChange={(open) => {
          if (!open) setPartnerAction(null);
        }}
      >
        {partnerAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {partnerAction.type === 'approve' ? 'Phê duyệt' : 'Từ chối'} đối tác
                &nbsp;&quot;{partnerAction.partner.companyName}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {partnerAction.type === 'approve'
                  ? 'Hồ sơ đối tác sẽ được phê duyệt và tài khoản đăng nhập được kích hoạt.'
                  : 'Hồ sơ đối tác sẽ bị từ chối và tài khoản đăng nhập bị khóa.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quay lại kiểm tra</AlertDialogCancel>
              <AlertDialogAction
                variant={partnerAction.type === 'approve' ? 'default' : 'destructive'}
                onClick={() =>
                  void (partnerAction.type === 'approve'
                    ? handleApprove(partnerAction.partner.partnerId)
                    : handleReject(partnerAction.partner.partnerId))
                }
              >
                {partnerAction.type === 'approve' ? 'Phê duyệt đối tác' : 'Từ chối đối tác'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import {
  MessageSquareWarning,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  User,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import toast from 'react-hot-toast';

interface UserInfo {
  email: string;
  fullName: string;
  phone: string;
}

interface CampaignInfo {
  title: string;
  partner?: { companyName: string };
}

interface OrderInfo {
  orderCode: string;
  totalAmount: number;
}

interface Complaint {
  complaintId: string;
  type: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' | 'CLOSED';
  resolutionResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
  customer?: UserInfo;
  resolvedBy?: UserInfo;
  campaign?: CampaignInfo;
  order?: OrderInfo;
}

const statusMap = {
  OPEN: { label: 'Đang mở', color: 'bg-amber-100 text-amber-700' },
  IN_REVIEW: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700' },
  RESOLVED: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Từ chối', color: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Đã đóng', color: 'bg-slate-100 text-slate-700' },
};

const typeMap: Record<string, string> = {
  VOUCHER: 'Voucher',
  ORDER: 'Đơn hàng',
  PAYMENT: 'Thanh toán',
  PARTNER: 'Đối tác',
  OTHER: 'Khác',
};

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterText, setFilterText] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('ALL');
  
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<string>('RESOLVED');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Complaint[]>('/complaints/admin/list');
      setComplaints(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Không thể tải danh sách khiếu nại.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchComplaints();
  }, []);

  const handleOpenDetail = async (id: string) => {
    try {
      const detail = await apiRequest<Complaint>(`/complaints/admin/${id}`);
      setSelectedComplaint(detail);
      setReplyText(detail.resolutionResponse || '');
      setReplyStatus(detail.status === 'OPEN' ? 'IN_REVIEW' : detail.status);
    } catch (error) {
      toast.error('Không thể tải chi tiết khiếu nại');
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!replyText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    
    setSubmitting(true);
    try {
      await apiRequest(`/complaints/admin/${selectedComplaint.complaintId}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: replyStatus,
          resolutionResponse: replyText,
        }),
      });
      
      toast.success('Gửi phản hồi thành công!');
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể gửi phản hồi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = complaints.filter(c => {
    if (activeStatus !== 'ALL' && c.status !== activeStatus) return false;
    if (filterText) {
      const term = filterText.toLowerCase();
      return c.subject.toLowerCase().includes(term) || 
             (c.customer?.fullName || '').toLowerCase().includes(term) ||
             (c.customer?.email || '').toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-primary" />
            Xử lý Khiếu nại
          </h1>
          <p className="text-sm text-muted mt-1">
            Quản lý, theo dõi và phản hồi các yêu cầu hỗ trợ từ khách hàng.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        
        {/* Filters */}
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-hide">
            <button
              onClick={() => setActiveStatus('ALL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeStatus === 'ALL' ? 'bg-foreground text-background' : 'bg-background border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              Tất cả
            </button>
            {['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  activeStatus === status ? 'bg-foreground text-background' : 'bg-background border border-border text-foreground hover:bg-muted/50'
                }`}
              >
                {statusMap[status as keyof typeof statusMap].label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input 
              type="text" 
              placeholder="Tìm theo tiêu đề, tên KH..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/30 text-xs uppercase font-bold text-muted border-b border-border">
              <tr>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Chủ đề</th>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    Không tìm thấy khiếu nại nào.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.complaintId} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold">{item.customer?.fullName}</div>
                      <div className="text-[10px] text-muted">{item.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="font-medium truncate" title={item.subject}>{item.subject}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] bg-secondary px-2 py-1 rounded font-semibold text-muted-foreground">
                        {typeMap[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${statusMap[item.status].color}`}>
                        {statusMap[item.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(item.complaintId)}
                        className="text-primary hover:text-primary-hover font-bold text-xs bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Xử lý
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL & REPLY MODAL */}
      <Dialog open={Boolean(selectedComplaint)} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        {selectedComplaint && (
          <DialogContent className="max-w-2xl bg-card border-border rounded-2xl overflow-hidden p-0 gap-0">
            <DialogHeader className="p-6 border-b border-border bg-muted/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusMap[selectedComplaint.status].color}`}>
                      {statusMap[selectedComplaint.status].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedComplaint.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-extrabold text-foreground">
                    {selectedComplaint.subject}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex flex-col md:flex-row h-[60vh] max-h-[600px]">
              
              {/* Left Column: Complaint Details */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-border space-y-6">
                
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Khách hàng
                  </h4>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    <p className="font-bold">{selectedComplaint.customer?.fullName}</p>
                    <p className="text-xs text-muted">{selectedComplaint.customer?.email}</p>
                    <p className="text-xs text-muted">{selectedComplaint.customer?.phone}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Chi tiết vấn đề
                  </h4>
                  <div className="bg-background border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed shadow-inner">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Liên kết liên quan */}
                {(selectedComplaint.order || selectedComplaint.campaign) && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider">Thông tin liên quan</h4>
                    <ul className="text-xs space-y-1">
                      {selectedComplaint.order && (
                        <li><strong>Đơn hàng:</strong> <span className="font-mono text-primary">{selectedComplaint.order.orderCode}</span> ({selectedComplaint.order.totalAmount.toLocaleString()}đ)</li>
                      )}
                      {selectedComplaint.campaign && (
                        <li><strong>Chiến dịch:</strong> {selectedComplaint.campaign.title} <span className="text-muted">({selectedComplaint.campaign.partner?.companyName})</span></li>
                      )}
                    </ul>
                  </div>
                )}
                
              </div>

              {/* Right Column: Admin Reply Form */}
              <div className="w-full md:w-1/2 p-6 flex flex-col bg-muted/5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                  <Send className="h-4 w-4 text-primary" /> Phản hồi khách hàng
                </h4>

                <form onSubmit={handleReplySubmit} className="flex-1 flex flex-col space-y-4">
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted">Trạng thái mới</label>
                    <select
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="IN_REVIEW">Đang xử lý (In Review)</option>
                      <option value="RESOLVED">Đã giải quyết (Resolved)</option>
                      <option value="REJECTED">Từ chối (Rejected)</option>
                      <option value="CLOSED">Đóng (Closed)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <label className="text-xs font-bold text-muted">Nội dung phản hồi</label>
                    <textarea
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Nhập nội dung giải quyết hoặc phản hồi cho khách hàng..."
                      className="w-full p-3 flex-1 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedComplaint(null)}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      {submitting ? 'Đang lưu...' : 'Lưu phản hồi'}
                    </button>
                  </div>
                  
                </form>

              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '../../../../components/Header';
import {
  MessageSquareWarning,
  Plus,
  AlertCircle,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Ticket,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import toast from 'react-hot-toast';

interface Campaign {
  title: string;
}

interface Order {
  orderCode: string;
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
  campaign?: Campaign;
  order?: Order;
}

const statusMap = {
  OPEN: { label: 'Đang mở', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  IN_REVIEW: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  RESOLVED: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: 'Từ chối', color: 'bg-red-100 text-red-700 border-red-200' },
  CLOSED: { label: 'Đã đóng', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const typeMap: Record<string, string> = {
  VOUCHER: 'Voucher',
  ORDER: 'Đơn hàng',
  PAYMENT: 'Thanh toán',
  PARTNER: 'Đối tác/Chi nhánh',
  OTHER: 'Khác',
};

export default function CustomerComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filter state
  const [filterText, setFilterText] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('ALL');

  // Modal create state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'VOUCHER',
    subject: '',
    description: '',
    orderId: '',
    campaignId: '',
  });

  // Expand row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchComplaints = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest<Complaint[]>('/complaints');
      setComplaints(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách khiếu nại.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/customer/complaints');
      } else {
        queueMicrotask(() => {
          void fetchComplaints();
        });
      }
    }
  }, [user, authLoading, router]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        type: formData.type,
        subject: formData.subject,
        description: formData.description,
      };
      if (formData.orderId.trim()) payload.orderId = formData.orderId.trim();
      if (formData.campaignId.trim()) payload.campaignId = formData.campaignId.trim();

      await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      toast.success('Gửi khiếu nại thành công!');
      setIsCreateOpen(false);
      setFormData({ type: 'VOUCHER', subject: '', description: '', orderId: '', campaignId: '' });
      fetchComplaints();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể gửi khiếu nại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    if (activeStatus !== 'ALL' && c.status !== activeStatus) return false;
    if (filterText) {
      const term = filterText.toLowerCase();
      return c.subject.toLowerCase().includes(term) || 
             c.description.toLowerCase().includes(term) ||
             (c.order?.orderCode || '').toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">
      <Header />
      
      {authLoading || loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-2xl">
                  <MessageSquareWarning className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Hỗ trợ & Khiếu nại</h1>
                  <p className="text-sm text-slate-500 mt-1">Gửi yêu cầu hỗ trợ và theo dõi tiến trình xử lý từ Ban quản trị.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-sm font-bold transition-all shadow-sm shadow-primary/20 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Tạo khiếu nại mới
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                <button
                  onClick={() => setActiveStatus('ALL')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    activeStatus === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({complaints.length})
                </button>
                {['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'].map(status => (
                  <button
                    key={status}
                    onClick={() => setActiveStatus(status)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      activeStatus === status ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {statusMap[status as keyof typeof statusMap].label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm..." 
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
                />
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              {filteredComplaints.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                  <MessageSquareWarning className="h-10 w-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-700">Chưa có khiếu nại nào</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Bạn chưa có yêu cầu hỗ trợ hoặc khiếu nại nào phù hợp với bộ lọc hiện tại.
                  </p>
                </div>
              ) : (
                filteredComplaints.map((item) => (
                  <div key={item.complaintId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div 
                      className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      onClick={() => setExpandedId(expandedId === item.complaintId ? null : item.complaintId)}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${statusMap[item.status].color}`}>
                            {statusMap[item.status].label}
                          </span>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                            Loại: {typeMap[item.type] || item.type}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 line-clamp-1">{item.subject}</h3>
                        
                        {(item.order || item.campaign) && (
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            {item.order && (
                              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5"/> Đơn: {item.order.orderCode}</span>
                            )}
                            {item.campaign && (
                              <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5"/> {item.campaign.title}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-end sm:justify-start">
                        {expandedId === item.complaintId ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {expandedId === item.complaintId && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 animate-fadeIn space-y-4">
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nội dung chi tiết:</h4>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                            {item.description}
                          </p>
                        </div>
                        
                        {item.resolutionResponse ? (
                          <div className="space-y-1.5 pt-2">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4" />
                              Phản hồi từ Admin:
                            </h4>
                            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-primary/5 p-4 rounded-xl border border-primary/20">
                              {item.resolutionResponse}
                            </div>
                            {item.resolvedAt && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Cập nhật lúc: {new Date(item.resolvedAt).toLocaleString('vi-VN')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 pt-2 italic">
                            <Clock className="h-3.5 w-3.5" />
                            Đang chờ phản hồi từ quản trị viên...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg p-6 bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-primary" />
              Gửi khiếu nại mới
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateComplaint} className="space-y-5 mt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Loại vấn đề *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {Object.entries(typeMap).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tiêu đề *</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ví dụ: Lỗi thanh toán không nhận được voucher..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mã đơn hàng (UUID)</label>
                <input
                  type="text"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  placeholder="ID đơn hàng liên quan"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mã chiến dịch (UUID)</label>
                <input
                  type="text"
                  value={formData.campaignId}
                  onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                  placeholder="ID chiến dịch liên quan"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">*Tùy chọn: Nhập mã định danh (UUID) nếu bạn khiếu nại về một đơn hàng cụ thể.</p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chi tiết vấn đề *</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả chi tiết tình huống bạn đang gặp phải để chúng tôi hỗ trợ tốt nhất..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm shadow-primary/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

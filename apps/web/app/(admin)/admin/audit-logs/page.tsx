'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  Calendar, 
  User, 
  FileText, 
  ChevronRight, 
  AlertCircle,
  Database,
  Tag
} from 'lucide-react';

interface AdminSnapshot {
  fullName: string | null;
  email: string | null;
}

interface AuditLog {
  logId: string;
  adminId: string;
  adminNameSnapshot: string;
  adminEmailSnapshot: string | null;
  actionType: string;
  targetEntity: string;
  targetId: string | null;
  timestamp: string;
}

export default function AdminAuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest('/admin/audit-logs');
      setLogs(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải nhật ký hoạt động hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'ADMIN') {
        router.push('/login?redirect=/admin/audit-logs');
      } else {
        fetchLogs();
      }
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const getActionBadgeClass = (action: string) => {
    if (action.includes('APPROVE')) return 'bg-green-100 text-green-700';
    if (action.includes('REJECT')) return 'bg-red-100 text-red-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Nhật ký kiểm toán</span>
      </div>

      <div className="pb-4 border-b border-border/60">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Nhật ký hoạt động hệ thống (Audit Logs)
        </h1>
        <p className="text-xs text-muted mt-1">Truy vết toàn bộ lịch sử thao tác của các Platform Administrator để đảm bảo tính minh bạch.</p>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TABLE */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Database className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Nhật ký trống</h3>
          <p className="text-xs text-muted">Chưa ghi nhận hoạt động nào của quản trị viên trên hệ thống.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Thời gian</th>
                  <th className="p-4">Quản trị viên</th>
                  <th className="p-4">Hành động</th>
                  <th className="p-4">Đối tượng</th>
                  <th className="p-4">Mã đối tượng (Target ID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => {
                  const formattedDate = new Date(log.timestamp).toLocaleString('vi-VN');

                  return (
                    <tr key={log.logId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-muted flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formattedDate}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {log.adminNameSnapshot}
                        </div>
                        <span className="text-[10px] text-muted">{log.adminEmailSnapshot}</span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${getActionBadgeClass(log.actionType)}`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-medium text-foreground flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5 text-slate-400" />
                        {log.targetEntity}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {log.targetId ? log.targetId.toUpperCase() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

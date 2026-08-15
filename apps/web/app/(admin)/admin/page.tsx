'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../lib/api';
import { Shield, Users, Ticket, ShoppingBag } from 'lucide-react';

interface AdminDashboardSummary {
  totalPartners: number;
  totalCampaigns: number;
  totalSuccessfulOrders: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await apiRequest('/partners/admin/dashboard');
        setSummary(data);
      } catch (error) {
        console.error('Không thể tải dashboard admin:', error);
        setSummary({
          totalPartners: 0,
          totalCampaigns: 0,
          totalSuccessfulOrders: 0,
          totalRevenue: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = [
    { name: 'Đối tác đã đăng ký', value: String(summary?.totalPartners ?? 0), icon: Users },
    { name: 'Chiến dịch Voucher', value: String(summary?.totalCampaigns ?? 0), icon: Ticket },
    { name: 'Đơn hàng thành công', value: String(summary?.totalSuccessfulOrders ?? 0), icon: ShoppingBag },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Hệ thống Quản trị, {user?.fullName || 'Admin'}!
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Chào mừng quay lại bảng quản trị hệ thống Online Discount Voucher System. Dữ liệu được thống kê trực tiếp từ cơ sở dữ liệu.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.name}
              className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">{item.name}</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{item.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Thông tin hướng dẫn</h3>
        <p className="text-xs text-muted leading-relaxed">
          Sử dụng thanh điều hướng bên cạnh để quản lý đối tác (duyệt hồ sơ doanh nghiệp mới đăng ký), phê duyệt các chương trình khuyến mãi/voucher được gửi lên từ đối tác, theo dõi đơn hàng thanh toán qua cổng thử nghiệm Sandbox và tra cứu nhật ký hệ thống.
        </p>
      </div>
    </div>
  );
}

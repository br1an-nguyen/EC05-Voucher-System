'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../lib/api';
import { Ticket, Users, TrendingUp, Landmark } from 'lucide-react';

interface PartnerDashboardSummary {
  partnerName: string;
  totalCampaigns: number;
  activeCampaigns: number;
  soldVouchers: number;
  customerCount: number;
  revenue: number;
}

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PartnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await apiRequest<PartnerDashboardSummary>('/partners/dashboard');
        setSummary(data);
      } catch (error) {
        console.error('Không thể tải dashboard đối tác:', error);
        setSummary({
          partnerName: user?.fullName || 'Đối tác',
          totalCampaigns: 0,
          activeCampaigns: 0,
          soldVouchers: 0,
          customerCount: 0,
          revenue: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user?.fullName]);

  const stats = useMemo(() => {
    const base = summary ?? {
      partnerName: user?.fullName || 'Đối tác',
      totalCampaigns: 0,
      activeCampaigns: 0,
      soldVouchers: 0,
      customerCount: 0,
      revenue: 0,
    };

    return [
      { name: 'Voucher đã phát hành', value: String(base.totalCampaigns), icon: Ticket, change: `${base.activeCampaigns} đang hoạt động`, changeType: 'positive' },
      { name: 'Khách hàng mua', value: String(base.customerCount), icon: Users, change: 'Tổng khách hàng phát sinh', changeType: 'positive' },
      { name: 'Doanh thu tạm tính', value: formatMoney(base.revenue), icon: TrendingUp, change: 'Tổng giá trị bán ra', changeType: 'positive' },
      { name: 'Tổng voucher đã bán', value: String(base.soldVouchers), icon: Landmark, change: `${base.activeCampaigns} chiến dịch đang kích hoạt`, changeType: 'neutral' },
    ];
  }, [summary, user?.fullName]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Xin chào, {user?.fullName || summary?.partnerName || 'Đối tác'}!
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Chào mừng bạn quay lại hệ thống quản trị VoucherNow. Dữ liệu dashboard được cập nhật theo tài khoản đối tác của bạn.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="mt-4 border-t border-border/60 pt-3">
                <span className="text-xs font-semibold text-primary">{item.change}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Giao dịch voucher gần đây</h3>
        </div>
        <div className="p-5">
          <div className="text-center py-8 text-sm text-muted">
            <Ticket className="h-8 w-8 text-muted/60 mx-auto mb-2" />
            <p>
              {summary && summary.totalCampaigns === 0
                ? 'Bạn chưa có chiến dịch voucher nào được phát hành. Hãy tạo chiến dịch đầu tiên để bắt đầu theo dõi doanh thu.'
                : 'Tất cả hoạt động hiển thị trên dashboard đang được tính theo tài khoản đối tác của bạn.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

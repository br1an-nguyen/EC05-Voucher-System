'use client';

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Ticket, Users, TrendingUp, Landmark } from 'lucide-react';

export default function PartnerDashboard() {
  const { user } = useAuth();

  // Mock số liệu khớp với seed data của Partner 1
  const stats = [
    { name: 'Voucher đã phát hành', value: '4', icon: Ticket, change: '+12% tuần này', changeType: 'positive' },
    { name: 'Khách hàng mua', value: '2', icon: Users, change: '+4% tuần này', changeType: 'positive' },
    { name: 'Doanh thu tạm tính', value: '185.000 đ', icon: TrendingUp, change: '+18% tuần này', changeType: 'positive' },
    { name: 'Tỷ lệ quy đổi', value: '50%', icon: Landmark, change: '1 đã dùng / 2 đã bán', changeType: 'neutral' },
  ];

  return (
    <div className="space-y-6">
      
      {/* LỜI CHÀO */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Xin chào, {user?.fullName || 'Đối tác'}!
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Chào mừng bạn quay lại hệ thống quản trị VoucherNow. Xem nhanh hiệu suất kinh doanh hôm nay.
        </p>
      </div>

      {/* KHO THẺ THỐNG KÊ */}
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

      {/* BẢNG MẪU HOẠT ĐỘNG GẦN ĐÂY */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Giao dịch voucher gần đây</h3>
        </div>
        <div className="p-5">
          <div className="text-center py-8 text-sm text-muted">
            <Ticket className="h-8 w-8 text-muted/60 mx-auto mb-2" />
            <p>Không có hoạt động đổi mã voucher nào phát sinh trong ngày hôm nay.</p>
          </div>
        </div>
      </div>

    </div>
  );
}

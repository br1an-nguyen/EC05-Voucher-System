'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import RoleGuard from '../../../components/RoleGuard';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  Ticket, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard,
  FileText,
  ShoppingBag
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Duyệt Đối tác', href: '/admin/partners', icon: Users },
    { name: 'Duyệt Voucher', href: '/admin/vouchers', icon: Ticket },
    { name: 'Quản lý Đơn hàng', href: '/admin/orders', icon: ShoppingBag },
    { name: 'Nhật ký hệ thống', href: '/admin/audit-logs', icon: ShieldAlert },
  ];

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        
        {/* Sidebar cho Desktop */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow shadow-primary/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <span className="ml-3 text-lg font-bold tracking-tight text-foreground">
                AdminPortal
              </span>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-secondary text-primary'
                        : 'text-foreground/75 hover:bg-secondary/40 hover:text-primary'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted group-hover:text-primary'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Thông tin tài khoản phía dưới Sidebar */}
            <div className="flex-shrink-0 flex border-t border-border p-4 bg-background/50">
              <div className="flex items-center w-full">
                <Link href="/profile" className="flex items-center group overflow-hidden" title="Xem hồ sơ cá nhân">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary/20 transition-colors">
                    {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{user?.fullName}</p>
                    <p className="text-[10px] text-muted truncate">Quản trị viên</p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="ml-auto p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between bg-card px-4 py-3 border-b border-border z-20">
          <div className="flex items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <span className="ml-2 text-md font-bold tracking-tight text-foreground">
              AdminPortal
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-foreground hover:bg-secondary/50"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Menu Sidebar */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-10 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-64 max-w-xs h-full bg-card border-r border-border p-5 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <span className="ml-2 text-md font-bold tracking-tight text-foreground">
                    AdminPortal
                  </span>
                </div>
                <nav className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg ${
                          isActive
                            ? 'bg-secondary text-primary'
                            : 'text-foreground/75 hover:bg-secondary/40'
                        }`}
                      >
                        <item.icon className={`mr-3 h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-border pt-4 flex items-center">
                <Link href="/profile" className="flex items-center group" title="Xem hồ sơ cá nhân">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary/20 transition-colors">
                    {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{user?.fullName}</p>
                    <p className="text-[10px] text-muted">Quản trị</p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="ml-auto p-1.5 rounded-lg text-muted hover:text-red-500"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Khung chứa Nội dung chính */}
        <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto flex-grow">
            {children}
          </div>
        </main>

      </div>
    </RoleGuard>
  );
}

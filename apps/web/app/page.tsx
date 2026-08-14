'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import { 
  Ticket, 
  Search, 
  MapPin, 
  Tag, 
  DollarSign, 
  ArrowRight, 
  LogOut, 
  User, 
  ShieldAlert, 
  Briefcase,
  Store,
  Grid,
  Filter,
  X,
  ShoppingCart,
  FileText
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
  saleStartTime: string;
  saleEndTime: string;
  partner: Partner;
  campaignBranches: CampaignBranch[];
}

export default function HomePage() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Gọi API lấy danh sách catalog với bộ lọc
  const fetchCatalog = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (category) params.append('category', category);
      if (maxPrice) params.append('maxPrice', maxPrice);

      const queryString = params.toString();
      const url = `/vouchers${queryString ? `?${queryString}` : ''}`;
      
      const data = await apiRequest(url);
      setCampaigns(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách voucher.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [category]); // tự động gọi lại khi đổi category

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCatalog();
  };

  const handleClearFilters = () => {
    setKeyword('');
    setCategory('');
    setMaxPrice('');
    // Chờ state update xong rồi fetch lại hoặc fetch trực tiếp
    setTimeout(() => {
      fetchCatalog();
    }, 50);
  };

  const categories = [
    { label: 'Tất cả', value: '' },
    { label: ' Buffets & Ăn uống', value: 'F&B' },
    { label: ' Mua sắm & Tiêu dùng', value: 'Shopping' },
    { label: ' Spa & Làm đẹp', value: 'Beauty' },
    { label: ' Giải trí & Vui chơi', value: 'Entertainment' },
    { label: 'Khác', value: 'Other' },
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      
      {/* 1. HEADER CHUNG */}
      <header className="bg-card border-b border-border py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <Ticket className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">VoucherNow</span>
          </Link>

          {/* Quyền người dùng & Đăng nhập */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Link portal theo role */}
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Admin Portal
                  </Link>
                )}
                {user.role === 'PARTNER' && (
                  <Link
                    href="/partner"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-primary hover:bg-secondary/70 transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    Partner Portal
                  </Link>
                )}
                {user.role === 'CUSTOMER' && (
                  <>
                    <Link
                      href="/customer/vouchers"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-primary hover:bg-secondary/70 transition-colors"
                    >
                      <Ticket className="h-4 w-4" />
                      Ví Voucher
                    </Link>
                    <Link
                      href="/customer/orders"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-primary hover:bg-secondary/70 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Đơn hàng
                    </Link>
                    <Link
                      href="/cart"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-primary hover:bg-secondary/70 transition-colors"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Giỏ hàng
                    </Link>
                  </>
                )}
                
                {/* Avatar user */}
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-foreground mr-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <span>{user.fullName}</span>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-muted hover:text-primary hover:bg-red-500/10 transition-all"
                  title="Đăng xuất"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-sm"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. SECTION BANNER THƯƠNG HIỆU */}
      <section className="bg-secondary/40 border-b border-border/50 py-12 px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
          Săn Voucher Hot, Đổi Ngay Lập Tức!
        </h1>
        <p className="text-sm text-muted max-w-lg mx-auto leading-relaxed">
          Nền tảng mua sắm voucher điện tử uy tín, thanh toán tiện lợi và đổi mã trực tiếp tại chi nhánh thông qua QR Code.
        </p>
      </section>

      {/* 3. NỘI DUNG CHÍNH (CATALOG) */}
      <main className="flex-grow max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* SIDEBAR BỘ LỌC */}
        <aside className="space-y-6 lg:col-span-1">
          
          {/* Form Tìm kiếm */}
          <form onSubmit={handleSearchSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Tìm kiếm Voucher
            </label>
            <div className="relative rounded-lg shadow-sm border border-border bg-card">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Nhập tên, mô tả..."
                className="block w-full rounded-lg border-0 bg-transparent py-2.5 pl-3 pr-9 text-sm text-foreground focus:outline-none placeholder-slate-400"
              />
              <button
                type="submit"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-primary"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* Lọc Khoảng giá */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Khoảng giá tối đa
            </label>
            <div className="flex items-center gap-2">
              <div className="relative rounded-lg shadow-sm border border-border bg-card flex-1">
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Giá tối đa (đ)"
                  className="block w-full rounded-lg border-0 bg-transparent py-2 px-3 text-xs text-foreground focus:outline-none placeholder-slate-400"
                />
              </div>
              <button
                onClick={fetchCatalog}
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Lọc
              </button>
            </div>
          </div>

          {/* Lọc danh mục */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Danh mục ẩm thực / dịch vụ
            </label>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => {
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.label}
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-foreground hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <Tag className={`h-3 w-3 ${isActive ? 'text-white' : 'text-muted'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear Filters */}
          <button
            onClick={handleClearFilters}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-slate-50 text-xs font-bold text-foreground rounded-lg transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Xóa bộ lọc
          </button>

        </aside>

        {/* LƯỚI DANH SÁCH VOUCHER */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Header catalog */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Grid className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Kết quả tìm kiếm ({campaigns.length} voucher)
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Grid voucher cards */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <Ticket className="h-12 w-12 text-muted/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground">Không tìm thấy voucher phù hợp</h3>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                Thử thay đổi từ khóa tìm kiếm hoặc lọc khoảng giá rộng hơn để săn nhiều khuyến mãi cực hot khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {campaigns.map((c) => {
                const discountPct = Math.round(((Number(c.originalPrice) - Number(c.salePrice)) / Number(c.originalPrice)) * 100);
                const remaining = c.capacity - c.soldQuantity;

                return (
                  <div
                    key={c.campaignId}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Thumbnail / Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="inline-block text-[9px] font-bold text-primary bg-primary/5 rounded px-1.5 py-0.5 uppercase tracking-wide">
                            {c.category || 'Ăn uống'}
                          </span>
                          <h3 className="text-sm font-bold text-foreground mt-1.5 line-clamp-1" title={c.title}>
                            {c.title}
                          </h3>
                          <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                            <Store className="h-3 w-3 shrink-0" />
                            <span>{c.partner.companyName}</span>
                          </div>
                        </div>

                        {/* Discount flag */}
                        {discountPct > 0 && (
                          <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-inset ring-red-600/10 shrink-0">
                            Giảm {discountPct}%
                          </span>
                        )}
                      </div>

                      {/* Prices & remaining */}
                      <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-border/60 pt-3">
                        <div>
                          <span className="text-base font-extrabold text-primary">
                            {Number(c.salePrice).toLocaleString('vi-VN')} đ
                          </span>
                          <span className="text-[10px] text-muted line-through ml-1.5">
                            {Number(c.originalPrice).toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                        <span className="text-[10px] text-muted font-medium">
                          Còn lại: {remaining} voucher
                        </span>
                      </div>

                      {/* Branch redemption */}
                      <div className="mt-3 flex items-start gap-1 text-[10px] text-muted">
                        <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <div className="line-clamp-1" title={c.campaignBranches.map(cb => cb.branch.name).join(', ')}>
                          Áp dụng tại: {c.campaignBranches.map(cb => cb.branch.name).join(', ')}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    <Link
                      href={`/voucher/${c.campaignId}`}
                      className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-primary hover:text-white text-foreground text-xs font-bold rounded-lg transition-all"
                    >
                      Xem chi tiết
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* 4. FOOTER CHUNG */}
      <footer className="bg-card border-t border-border py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted mt-12">
        <p>© 2026 Online Discount Voucher System. All Rights Reserved.</p>
        <p className="mt-1 text-[10px] text-muted/65">Đồ án môn học Thương mại điện tử EC05 - HCMUS</p>
      </footer>

    </div>
  );
}

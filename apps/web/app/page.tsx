'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import FilterSidebar from '../components/FilterSidebar';
import VoucherCard from '../components/VoucherCard';
import { ShieldAlert, Ticket, Grid } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for filtering
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [maxPrice, setMaxPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCatalog = useCallback(async (overrides?: { kw?: string, cat?: string, maxP?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      
      const currentKeyword = overrides?.kw !== undefined ? overrides.kw : keyword;
      const currentCategory = overrides?.cat !== undefined ? overrides.cat : category;
      const currentMaxPrice = overrides?.maxP !== undefined ? overrides.maxP : maxPrice;
      
      if (currentKeyword) params.append('keyword', currentKeyword);
      if (currentCategory) params.append('category', currentCategory);
      if (currentMaxPrice) params.append('maxPrice', currentMaxPrice);

      const queryString = params.toString();
      const url = `/vouchers${queryString ? `?${queryString}` : ''}`;
      
      const data = await apiRequest(url);
      setCampaigns(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách voucher.');
    } finally {
      setLoading(false);
    }
  }, [keyword, category, maxPrice]);

  useEffect(() => {
    fetchCatalog();
  }, [category, fetchCatalog]);

  const scrollToProducts = () => {
    document.getElementById('product-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleHeaderSearch = (newKeyword: string) => {
    setKeyword(newKeyword);
    const params = new URLSearchParams(searchParams.toString());
    if (newKeyword) params.set('keyword', newKeyword);
    else params.delete('keyword');
    router.push(`/?${params.toString()}`, { scroll: false });
    
    fetchCatalog({ kw: newKeyword });
    setTimeout(scrollToProducts, 50);
  };

  const handleSidebarFilter = () => {
    fetchCatalog();
    scrollToProducts();
  };

  const handleClearFilters = () => {
    setKeyword('');
    setCategory('');
    setMaxPrice('');
    router.push('/', { scroll: false });
    
    fetchCatalog({ kw: '', cat: '', maxP: '' });
    setTimeout(scrollToProducts, 50);
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      
      <Header onSearch={handleHeaderSearch} initialKeyword={keyword} />
      
      <HeroBanner />

      <main id="product-section" className="flex-grow max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <FilterSidebar
            keyword={keyword}
            setKeyword={setKeyword}
            category={category}
            setCategory={setCategory}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            onFilter={handleSidebarFilter}
            onClear={handleClearFilters}
          />
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Grid className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                Gợi ý cho bạn
              </h2>
            </div>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {campaigns.length} kết quả
            </span>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center">
              <div className="inline-block relative w-12 h-12">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-primary/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-full h-full border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">Đang tìm kiếm deal hot...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy voucher phù hợp</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Thử thay đổi từ khóa tìm kiếm hoặc lọc khoảng giá rộng hơn để săn nhiều khuyến mãi cực hot khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((c, i) => (
                <VoucherCard key={c.campaignId} campaign={c} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Ticket className="h-6 w-6 text-slate-800" />
            <span className="text-xl font-black text-slate-800 tracking-tight">VoucherNow</span>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hệ thống phân phối Voucher Điện Tử</p>
            <p className="text-[10px] text-slate-400 mt-1">Đồ án môn học Thương mại điện tử EC05 - HCMUS © 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { 
  Ticket, 
  Search, 
  LogOut, 
  ShieldAlert, 
  Briefcase,
  ShoppingCart,
  FileText,
  User as UserIcon,
  Bell,
  Menu,
  X
} from 'lucide-react';

interface HeaderProps {
  onSearch?: (keyword: string) => void;
  initialKeyword?: string;
}

export default function Header({ onSearch, initialKeyword = '' }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      apiRequest('/cart')
        .then((data: any) => {
          const count = Array.isArray(data) ? data.reduce((acc, item) => acc + (item.quantity || 1), 0) : 0;
          setCartItemCount(count);
        })
        .catch(() => {
          setCartItemCount(0);
        });
    }
  }, [user]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!keyword.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest(`/vouchers?keyword=${encodeURIComponent(keyword)}`)
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            const titles = data.map(item => item.title);
            const uniqueTitles = Array.from(new Set(titles)).slice(0, 5);
            setSuggestions(uniqueTitles as string[]);
          }
        })
        .catch(() => setSuggestions([]));
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [keyword]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(keyword);
    } else {
      router.push(`/?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(suggestion);
    } else {
      router.push(`/?keyword=${encodeURIComponent(suggestion)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
      {/* Main Header Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4 lg:gap-8">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-md transform transition hover:scale-105">
            <Ticket className="h-6 w-6" />
          </div>
          <span className="hidden sm:block text-2xl font-black tracking-tight text-primary drop-shadow-sm">
            VoucherNow
          </span>
        </Link>

        {/* Search Bar - Center */}
        <div className="flex-1 max-w-2xl hidden md:block relative" onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}>
          <form onSubmit={handleSearch} className="relative flex items-center w-full">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Tìm voucher ẩm thực, làm đẹp, giải trí..."
              className="w-full pl-4 pr-20 py-2.5 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-primary/30 rounded-xl text-sm transition-all outline-none text-foreground placeholder:text-slate-400"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setSuggestions([]);
                }}
                className="absolute right-10 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-full"
                title="Xóa từ khóa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 p-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
              <ul>
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button 
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      <Search className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="line-clamp-1">{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Mobile Search & Menu (Visible only on small screens) */}
        <div className="flex md:hidden flex-1 justify-end gap-2">
            <button className="p-2 text-slate-600 hover:text-primary bg-slate-100 rounded-full">
              <Search className="h-5 w-5" />
            </button>
            <button className="p-2 text-slate-600 hover:text-primary bg-slate-100 rounded-full">
              <Menu className="h-5 w-5" />
            </button>
        </div>

        {/* Actions & Profile - Right */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {user ? (
            <>
              {/* Portals based on role */}
              {user.role === 'ADMIN' && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Admin
                </Link>
              )}
              {user.role === 'PARTNER' && (
                <Link href="/partner" className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                  Partner
                </Link>
              )}
              {user.role === 'CUSTOMER' && (
                <>
                  <Link href="/cart" className="relative p-2 text-slate-600 hover:text-primary transition-colors group">
                    <ShoppingCart className="h-6 w-6" />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white group-hover:scale-110 transition-transform">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </Link>
                  <Link href="/customer/orders" className="p-2 text-slate-600 hover:text-primary transition-colors" title="Đơn hàng">
                    <FileText className="h-6 w-6" />
                  </Link>
                  <Link href="/customer/vouchers" className="p-2 text-slate-600 hover:text-primary transition-colors" title="Ví Voucher">
                    <Ticket className="h-6 w-6" />
                  </Link>
                </>
              )}
              
              {/* Profile Dropdown (Simplified as hover group for MVP) */}
              <div className="relative group ml-2 border-l border-slate-200 pl-4 flex items-center gap-2 cursor-pointer">
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : <UserIcon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-medium">Tài khoản</span>
                  <span className="text-sm font-bold text-slate-800 line-clamp-1 max-w-[100px]">{user.fullName || 'User'}</span>
                </div>
                
                {/* Dropdown Menu */}
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 z-50">
                  <div className="p-2 space-y-1">
                    <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg transition-colors">
                      <UserIcon className="h-4 w-4" /> Thông tin hồ sơ
                    </Link>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors">
                Đăng nhập
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

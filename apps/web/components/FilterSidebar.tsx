'use client';

import React from 'react';
import { Tag, X, Filter } from 'lucide-react';

interface CategoryFilterOption {
  code: string;
  name: string;
  campaignCount: number;
  children?: CategoryFilterOption[];
}

export interface FilterSidebarProps {
  category: string;
  categories: CategoryFilterOption[];
  totalCampaigns: number;
  onCategoryChange: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (val: string) => void;
  onFilter: () => void;
  onClear: () => void;
}

export default function FilterSidebar({
  category,
  categories,
  totalCampaigns,
  onCategoryChange,
  maxPrice,
  setMaxPrice,
  onFilter,
  onClear
}: FilterSidebarProps) {
  const renderCategoryButton = (option: CategoryFilterOption, nested = false) => {
    const isActive = category === option.code;
    return (
      <button
        key={option.code || 'all'}
        onClick={() => onCategoryChange(option.code)}
        className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition-all ${
          nested ? 'pl-6' : ''
        } ${
          isActive
            ? 'bg-primary text-white shadow-md'
            : nested
              ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
        }`}
      >
        <span>{option.name}</span>
        <span className="flex items-center gap-2">
          <span className={isActive ? 'text-white/80' : 'text-slate-400'}>
            {option.campaignCount}
          </span>
          {isActive && <Tag className="h-3.5 w-3.5 text-white/90" />}
        </span>
      </button>
    );
  };
  
  return (
    <aside className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
          Bộ lọc tìm kiếm
        </h2>
      </div>

      {/* Khoảng giá */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">Khoảng giá</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Tối đa (đ)"
            className="w-full bg-slate-50 border border-slate-200 focus:border-primary/50 focus:bg-white rounded-xl px-3 py-2 text-sm outline-none transition-all"
          />
        </div>
        <button
          onClick={onFilter}
          className="w-full py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold rounded-xl transition-all border border-transparent"
        >
          Áp dụng
        </button>
      </div>

      {/* Danh mục */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">Danh mục</label>
        <div className="flex flex-col gap-1.5">
          {renderCategoryButton({ code: '', name: 'Tất cả', campaignCount: totalCampaigns })}
          {categories.map((parent) => (
            <div key={parent.code} className="space-y-1">
              {renderCategoryButton(parent)}
              {parent.children?.map((child) => renderCategoryButton(child, true))}
            </div>
          ))}
        </div>
      </div>

      {/* Xóa lọc */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all"
        >
          <X className="h-4 w-4" />
          Xóa tất cả
        </button>
      </div>
    </aside>
  );
}

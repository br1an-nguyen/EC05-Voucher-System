'use client';

import React from 'react';
import { Tag, X, Filter, ChevronDown, MapPin } from 'lucide-react';

interface CategoryFilterOption {
  code: string;
  name: string;
  campaignCount: number;
  children?: CategoryFilterOption[];
}

interface ProvinceFilterOption {
  code: string;
  name: string;
  campaignCount: number;
}

export interface FilterSidebarProps {
  category: string;
  categories: CategoryFilterOption[];
  totalCampaigns: number;
  onCategoryChange: (value: string) => void;
  province: string;
  provinces: ProvinceFilterOption[];
  onProvinceChange: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (val: string) => void;
  onFilter: () => void;
  onClear: () => void;
  onQuickPrice?: (val: string) => void;
}

export default function FilterSidebar({
  category,
  categories,
  totalCampaigns,
  onCategoryChange,
  province,
  provinces,
  onProvinceChange,
  maxPrice,
  setMaxPrice,
  onFilter,
  onClear,
  onQuickPrice
}: FilterSidebarProps) {
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setMaxPrice('');
      return;
    }
    setMaxPrice(Number(rawValue).toLocaleString('vi-VN'));
  };

  const quickPrices = [
    { label: '< 100K', value: '100.000' },
    { label: '< 200K', value: '200.000' },
    { label: '< 500K', value: '500.000' },
  ];

  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  const toggleCategory = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const renderCategoryButton = (option: CategoryFilterOption, nested = false, hasChildren = false) => {
    const isActive = category === option.code;
    const isExpanded = expandedCategories[option.code];

    return (
      <button
        key={option.code || 'all'}
        onClick={() => onCategoryChange(option.code)}
        className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition-all group ${
          nested ? 'pl-8' : ''
        } ${
          isActive
            ? 'bg-primary text-white shadow-md'
            : nested
              ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
        }`}
      >
        <span className="flex items-center gap-2">
          {!nested && option.code !== '' && (
            <span
              onClick={(e) => {
                if (hasChildren) toggleCategory(option.code, e);
              }}
              className={`p-1 rounded-md transition-colors ${
                hasChildren ? (isActive ? 'hover:bg-white/20 cursor-pointer' : 'hover:bg-slate-200 cursor-pointer') : 'opacity-30'
              }`}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isExpanded && hasChildren ? '' : '-rotate-90'}`}
              />
            </span>
          )}
          <span className={!nested && option.code === '' ? 'pl-5' : ''}>{option.name}</span>
        </span>
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

      {/* Khu vực */}
      <div className="space-y-3">
        <label htmlFor="province-filter" className="block text-xs font-bold text-slate-700">
          Khu vực
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            id="province-filter"
            value={province}
            onChange={(event) => onProvinceChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-primary/50 focus:bg-white"
          >
            <option value="">Tất cả khu vực</option>
            {provinces.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name} ({option.campaignCount})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Khoảng giá */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">Khoảng giá</label>
        
        <div className="grid grid-cols-3 gap-2">
          {quickPrices.map((qp) => (
            <button
              key={qp.value}
              onClick={() => {
                setMaxPrice(qp.value);
                if (onQuickPrice) onQuickPrice(qp.value);
              }}
              className={`text-center px-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all truncate ${
                maxPrice === qp.value
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
              }`}
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={maxPrice}
            onChange={handlePriceChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFilter();
            }}
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
              {renderCategoryButton(parent, false, (parent.children?.length ?? 0) > 0)}
              {expandedCategories[parent.code] &&
                parent.children?.map((child) => renderCategoryButton(child, true))}
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

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Store, ArrowRight, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

export interface VoucherCampaignCard {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  partner: { companyName: string };
  primaryBrand?: { displayName: string } | null;
  primaryCategory?: { nameVi: string } | null;
  campaignBranches: { branch: { name: string } }[];
}

export interface VoucherCardProps {
  campaign: VoucherCampaignCard;
  index?: number;
}

export default function VoucherCard({ campaign: c, index = 0 }: VoucherCardProps) {
  const thumbnailUrl = c.thumbnailUrl ?? c.thumbnail_url;
  const brandName = c.primaryBrand?.displayName ?? c.partner.companyName;
  const categoryName = c.primaryCategory?.nameVi ?? c.category ?? 'Khác';
  const discountPct = Math.round(((Number(c.originalPrice) - Number(c.salePrice)) / Number(c.originalPrice)) * 100);
  const remaining = c.capacity - c.soldQuantity;
  const soldPercent = Math.min(Math.round((c.soldQuantity / c.capacity) * 100), 100);
  
  // Choose a gradient based on category or index for visual variety
  const gradients = [
    'from-orange-400 to-rose-400',
    'from-cyan-400 to-blue-500',
    'from-emerald-400 to-teal-500',
    'from-purple-400 to-indigo-500',
    'from-pink-400 to-rose-500'
  ];
  const bgGradient = gradients[index % gradients.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="group flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* Top Image / Gradient Area */}
      <div className={`relative h-40 w-full p-4 flex flex-col justify-between overflow-hidden ${!thumbnailUrl ? `bg-gradient-to-br ${bgGradient}` : 'bg-slate-100'}`}>
        {/* Background Image / Pattern */}
        {thumbnailUrl ? (
          <>
            {/* Lớp nền mờ (Blurred background) để lấp đầy khoảng trống */}
            <Image src={thumbnailUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" unoptimized className="object-cover blur-md opacity-40 scale-110" />
            {/* Ảnh chính thu nhỏ lại hiển thị trọn vẹn */}
            <Image src={thumbnailUrl} alt={c.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" unoptimized className="object-contain p-1 drop-shadow-md" />
          </>
        ) : (
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        )}
        
        <div className="relative flex justify-between items-start">
          <span className="inline-block text-[10px] font-black text-slate-800 bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1 uppercase tracking-wider shadow-sm">
            {categoryName}
          </span>
          
          {discountPct > 0 && (
            <div className="bg-red-500 text-white font-black text-xs px-2 py-1 rounded-bl-xl rounded-tr-lg shadow-md absolute top-0 right-0">
              -{discountPct}%
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px] group-hover:text-primary transition-colors" title={c.title}>
          {c.title}
        </h3>
        
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Store className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <span className="truncate max-w-[45%] font-semibold text-slate-600" title={brandName}>
            {brandName}
          </span>
          
          <span className="text-slate-300 mx-0.5">•</span>
          
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate" title={c.campaignBranches.map(cb => cb.branch.name).join(', ')}>
            {c.campaignBranches.length > 0 ? c.campaignBranches[0].branch.name : 'Nhiều chi nhánh'}
            {c.campaignBranches.length > 1 && ` +${c.campaignBranches.length - 1} nơi`}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-400 line-through font-medium mb-0.5">
              {Number(c.originalPrice).toLocaleString('vi-VN')} đ
            </div>
            <div className="text-lg font-black text-primary leading-none">
              {Number(c.salePrice).toLocaleString('vi-VN')}
              <span className="text-sm font-bold align-top ml-0.5">đ</span>
            </div>
          </div>
        </div>

        {/* Progress Bar for Sold Quantity */}
        <div className="mt-4">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-orange-400 to-primary h-full rounded-full"
              style={{ width: `${soldPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-medium">
            <span className="text-primary flex items-center gap-1">
              <Flame className="h-3 w-3" /> Đã bán {c.soldQuantity}
            </span>
            <span className="text-slate-500">Còn lại {remaining}</span>
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={`/voucher/${c.campaignId}`}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-primary/5 hover:bg-primary text-primary hover:text-white font-bold rounded-xl transition-all duration-300 border border-primary/10 hover:border-primary"
        >
          Mua Ngay
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function HeroBanner() {
  return (
    <div className="relative bg-gradient-to-r from-primary to-[#ff7e5f] overflow-hidden rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 shadow-lg">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
      <div className="absolute bottom-0 left-10 -mb-20 w-48 h-48 rounded-full bg-white opacity-10 blur-2xl"></div>
      
      <div className="relative px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20 flex flex-col md:flex-row items-center justify-between gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-left max-w-xl text-white"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <Flame className="h-4 w-4 text-yellow-300" />
            <span className="text-white">Siêu Sale Giữa Tháng</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 leading-tight drop-shadow-md">
            Săn Voucher Độc Quyền <br className="hidden sm:block" />
            Giảm Đến <span className="text-yellow-300">50%</span>
          </h1>
          
          <p className="text-sm sm:text-base text-white/90 mb-8 max-w-lg leading-relaxed">
            Hàng ngàn deal ẩm thực, làm đẹp, giải trí cực hot đang chờ đón bạn. Thanh toán nhanh chóng, sử dụng dễ dàng qua mã QR.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <button 
              className="px-6 py-3 bg-white text-primary hover:bg-slate-50 font-bold rounded-xl shadow-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
              onClick={() => window.scrollTo({ top: 500, behavior: 'smooth' })}
            >
              Săn Deal Ngay
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link 
              href="/register"
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Trở thành Đối tác
            </Link>
          </div>
        </motion.div>

        {/* Right side illustration / graphic */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="hidden md:flex relative"
        >
          <div className="relative w-64 h-64 lg:w-80 lg:h-80">
            <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300 to-orange-400 rounded-full animate-pulse opacity-20 blur-xl"></div>
            <div className="relative w-full h-full flex items-center justify-center">
               <div className="w-48 h-28 bg-white rounded-xl shadow-2xl transform -rotate-12 flex items-center justify-center border-4 border-dashed border-primary/20">
                  <div className="text-center">
                    <div className="text-2xl font-black text-primary">GIẢM 50%</div>
                    <div className="text-xs text-slate-500 font-medium">Tất cả dịch vụ</div>
                  </div>
               </div>
               <div className="absolute w-40 h-24 bg-yellow-300 rounded-xl shadow-xl transform rotate-6 ml-20 mt-20 flex items-center justify-center border-2 border-white">
                  <div className="text-center">
                    <div className="text-xl font-black text-amber-800">BUFFET</div>
                    <div className="text-xs text-amber-800/70 font-bold uppercase">Chỉ từ 199k</div>
                  </div>
               </div>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
}

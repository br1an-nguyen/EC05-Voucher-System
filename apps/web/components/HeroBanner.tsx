import { ArrowRight, BadgeCheck, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function HeroBanner() {
  return (
    <section className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="landing-hero-title">
      <div className="relative overflow-hidden rounded-ui-lg bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),_transparent_36%),linear-gradient(135deg,#9a3412_0%,#ea580c_52%,#fb7185_100%)] shadow-ui-raised">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/20 bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" aria-hidden="true" />

        <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:px-16 lg:py-16">
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <BadgeCheck className="h-4 w-4 text-amber-200" aria-hidden="true" />
              Marketplace voucher điện tử
            </div>

            <h1 id="landing-hero-title" className="max-w-2xl font-black leading-[1.08] tracking-tight text-white">
              Ưu đãi đúng nơi.
              <span className="block text-amber-200">Trải nghiệm đúng lúc.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-orange-50 sm:text-base">
              Khám phá voucher ẩm thực, làm đẹp và giải trí từ các đối tác đã được kiểm duyệt. Mua trong vài bước, nhận mã QR riêng và sử dụng tại chi nhánh áp dụng.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-ui-md bg-surface px-6 py-3 font-extrabold text-brand shadow-ui transition hover:-translate-y-0.5 hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Bắt đầu săn ưu đãi
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-ui-md border border-white/30 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Xem cách hoạt động
              </a>
            </div>

            <p className="mt-5 flex items-center gap-2 text-xs text-orange-100/90">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Thanh toán đang vận hành ở chế độ mô phỏng của đồ án.
            </p>
          </div>

          <div
            className="relative mx-auto hidden min-h-72 w-full max-w-md md:block"
            aria-hidden="true"
          >
            <div className="absolute inset-x-8 top-4 h-56 rounded-full bg-amber-200/20 blur-3xl" />

            <div className="absolute left-0 top-3 w-[82%] -rotate-3 rounded-ui-lg border border-white/70 bg-surface p-5 text-foreground shadow-ui-raised">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600">Đã kiểm duyệt</p>
                  <p className="mt-2 font-black text-slate-900">Chiến dịch hợp lệ trước khi mở bán</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-success-subtle text-success">
                  <BadgeCheck className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
              </div>
            </div>

            <div className="absolute bottom-2 right-0 w-[74%] rotate-3 rounded-ui-lg border border-white/70 bg-surface-inverse p-5 text-white shadow-ui-raised">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ui-md bg-surface text-foreground">
                  <QrCode className="h-8 w-8" />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-300">Mã QR riêng</p>
                  <p className="mt-1 font-bold">Sẵn sàng trong ví voucher</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-ui-sm bg-white/10 px-3 py-2 text-xs text-slate-200">
                <MapPin className="h-4 w-4 text-orange-300" />
                Kiểm tra đúng chi nhánh áp dụng
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

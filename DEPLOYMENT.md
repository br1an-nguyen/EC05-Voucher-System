# Hướng dẫn Triển khai Hệ thống Voucher Điện tử (VoucherNow)

Tài liệu này hướng dẫn chi tiết cách cấu hình và triển khai dự án **VoucherNow** (bao gồm NestJS Backend API và Next.js Frontend Web) lên các môi trường cloud hosting phổ biến: **Vercel**, **Railway**, hoặc **Render**, kết hợp cơ sở dữ liệu **Supabase PostgreSQL**.

---

## 1. Môi trường Cơ sở dữ liệu: Supabase PostgreSQL

Dự án sử dụng Supabase PostgreSQL làm hệ quản trị cơ sở dữ liệu chính.

### Cấu hình biến môi trường trên Supabase:
Đảm bảo bạn đã kích hoạt dự án trên Supabase và lấy chuỗi kết nối (connection string).
- **DATABASE_URL**: Chuỗi kết nối trực tiếp đến PostgreSQL (chế độ Transaction hoặc Session).
  `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?pgbouncer=true`
- **DIRECT_URL**: Chuỗi kết nối trực tiếp bỏ qua connection pooler (dành cho chạy migration).
  `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

### Chạy migration lên Supabase:
Từ thư mục dự án cục bộ, chạy lệnh sau để đồng bộ cấu trúc DB:
```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## 2. Triển khai Backend API: NestJS (Render hoặc Railway)

Cả **Railway** và **Render** đều hỗ trợ build từ Dockerfile hoặc chạy trực tiếp thông qua Node.js Build Command.

### Cấu hình trên Railway / Render:
1. **Repository Source**: Liên kết tài khoản GitHub và chọn kho mã nguồn dự án.
2. **Root Directory**: `apps/api`
3. **Build Command**: `npm install && npm run build` (hoặc chạy từ root workspace bằng lệnh `npm install && npm run build:api`)
4. **Start Command**: `node dist/main`
5. **Biến môi trường (Environment Variables)**:
   Cần điền đầy đủ các biến môi trường sau trên bảng điều khiển quản lý của Render/Railway:

   | Tên biến | Kiểu mẫu / Giá trị | Mô tả |
   | :--- | :--- | :--- |
   | `PORT` | `3001` | Cổng HTTP mà NestJS lắng nghe |
   | `DATABASE_URL` | `postgresql://...` | Chuỗi kết nối cơ sở dữ liệu Prisma |
   | `JWT_ACCESS_SECRET` | `super-secret-access-key` | Khóa bảo mật mã hóa JWT Access Token |
   | `JWT_REFRESH_SECRET` | `super-secret-refresh-key` | Khóa bảo mật mã hóa JWT Refresh Token |
   | `STRIPE_SECRET_KEY` | `sk_test_...` | Khóa Stripe Secret từ Stripe Dashboard |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Khóa webhook Stripe để verify chữ ký |
   | `PAYPAL_CLIENT_ID` | `Client_ID_Sandbox` | Client ID từ PayPal Developer Portal |
   | `PAYPAL_CLIENT_SECRET` | `Secret_Sandbox` | Secret Key từ PayPal Developer Portal |
   | `VNPAY_TMN_CODE` | `VNPAY_TMN_CODE` | Mã định danh terminal do VNPay cấp |
   | `VNPAY_HASH_SECRET` | `VNPAY_HASH_SECRET` | Chuỗi bảo mật mã hóa HMAC-SHA512 VNPay |
   | `VNPAY_URL` | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | Cổng thanh toán Sandbox của VNPay |
   | `FRONTEND_URL` | `https://vouchernow.vercel.app` | URL domain của trang Next.js Frontend |

---

## 3. Triển khai Frontend Web: Next.js (Vercel)

Next.js hoạt động tối ưu nhất khi được host trên **Vercel**.

### Cấu hình trên Vercel:
1. **Import Project**: Chọn kho lưu trữ GitHub của bạn trên Vercel.
2. **Framework Preset**: Chọn `Next.js`.
3. **Root Directory**: Chọn `apps/web`.
4. **Build and Output Settings**: Giữ mặc định (Vercel tự nhận diện lệnh build).
5. **Environment Variables**:
   Thêm các biến môi trường phục vụ client-side kết nối đến API:

   | Tên biến | Kiểu mẫu / Giá trị | Mô tả |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://vouchernow-api.up.railway.app` | URL trỏ đến NestJS Backend API vừa deploy |

Sau khi cấu hình xong, Vercel sẽ tự động build ứng dụng và cấp cho bạn một URL public hoạt động trực tuyến.

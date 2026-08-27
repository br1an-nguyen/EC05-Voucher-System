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
    | `JWT_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự | Khóa ký JWT bắt buộc của API |
    | `APP_ENV` | `production` | Bật chính sách cookie production |
    | `AUTH_COOKIE_SECURE` | `true` | Chỉ gửi refresh cookie qua HTTPS |
    | `AUTH_COOKIE_SAME_SITE` | `none` | Cho phép Vercel gửi cookie tới API Railway/Render khác site |
    | `TRUST_PROXY` | `1` | Lấy đúng IP client qua một reverse proxy để rate limit |
   | `STRIPE_SECRET_KEY` | `sk_test_...` | Khóa Stripe Secret từ Stripe Dashboard |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Khóa webhook Stripe để verify chữ ký |
   | `PAYPAL_CLIENT_ID` | `Client_ID_Sandbox` | Client ID từ PayPal Developer Portal |
   | `PAYPAL_CLIENT_SECRET` | `Secret_Sandbox` | Secret Key từ PayPal Developer Portal |
   | `ZALOPAY_APP_ID` | `553` | App ID Sandbox của ZaloPay |
   | `ZALOPAY_KEY1` | `...` | Khóa ký yêu cầu tạo đơn (Key1) |
   | `ZALOPAY_KEY2` | `...` | Khóa xác minh callback (Key2) |
   | `ZALOPAY_CALLBACK_URL` | `https://api.example.com/payments/zalopay/callback` | Callback HTTPS công khai để ZaloPay xác nhận thanh toán |
   | `ZALOPAY_REDIRECT_URL` | `https://web.example.com/payments/return/zalopay` | Trang web hiển thị trạng thái sau khi khách quay lại |
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

## 4. Chính sách phiên đăng nhập

- Access token tồn tại 15 phút và chỉ được giữ trong memory của web app.
- Refresh token nằm trong cookie `HttpOnly`; không lưu trong `localStorage`.
- Session hết hạn sau 60 phút không hoạt động và luôn kết thúc tối đa sau 2 giờ kể từ lúc đăng nhập.
- Mỗi tài khoản chỉ có một session đang hoạt động; đăng nhập mới sẽ thu hồi session cũ.
- Migration `add_auth_sessions` chủ động vô hiệu các refresh token thuộc cơ chế cũ, vì vậy người dùng phải đăng nhập lại một lần sau khi deploy.
- Rate limit mặc định dùng bộ nhớ của một API instance. Khi scale nhiều replica, cần cấu hình một throttler storage dùng chung như Redis.

Rate limit theo IP: mặc định 120 request/phút; đăng nhập 5/phút; đăng ký 3/10 phút; quên mật khẩu 3/15 phút; đặt lại mật khẩu 5/15 phút; refresh 20/phút; logout và heartbeat hoạt động 10/phút.

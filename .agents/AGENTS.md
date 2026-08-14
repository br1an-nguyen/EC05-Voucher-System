# Project Coding Rules & Guidelines (Quy tắc viết code của dự án)

Tài liệu này định nghĩa các nguyên tắc phát triển phần mềm, quy chuẩn viết mã (coding conventions) và cách chú thích (commenting) cho dự án **Hệ thống Voucher Điện tử (Online Discount Voucher System)**. Các AI Agent và thành viên dự án phải tuân thủ nghiêm ngặt các quy tắc này nhằm giúp cả nhóm (4 thành viên) dễ dàng đọc hiểu, bảo trì và phát triển tiếp nối.

---

## 1. Nguyên Tắc Đơn Giản Hóa (Simplicity First)

- **Tránh tối đa Over-engineering:** Không sử dụng các pattern quá phức tạp hoặc trừu tượng hóa không cần thiết. Viết code tuần tự, tường minh và dễ theo dõi.
- **Giữ hàm ngắn gọn và đơn nhiệm (Single Responsibility):** Mỗi service method, controller endpoint hoặc React component chỉ nên thực hiện một nhiệm vụ rõ ràng. Hàm không nên vượt quá 50 dòng code trừ trường hợp đặc biệt (như transaction thanh toán).
- **Tránh lồng cấu trúc điều kiện quá sâu (Deep Nesting):** Sử dụng các câu lệnh `guard clauses` (return sớm khi gặp điều kiện sai hoặc lỗi) để cấu trúc code phẳng hơn.
  *Ví dụ:*
  ```typescript
  // NÊN DÙNG: Cấu trúc phẳng, dễ đọc
  async redeemCode(code: string, branchId: string) {
    const voucher = await this.findVoucher(code);
    if (!voucher) throw new NotFoundException('Không tìm thấy mã');
    if (voucher.status !== 'AVAILABLE') throw new BadRequestException('Mã không khả dụng');
    
    // Xử lý logic chính...
  }
  ```

---

## 2. Quy Chuẩn Viết Comment (Commenting Rules)

Để giúp 4 thành viên của nhóm dễ dàng nắm bắt mã nguồn, hãy áp dụng quy chuẩn chú thích bằng **Tiếng Việt** rõ ràng và khoa học:

### 2.1. Chú thích ở cấp độ API & Hàm (JSDoc)
Mỗi Service Method, Controller Endpoint, Utility Function phải có chú thích JSDoc ngắn gọn giải thích:
- Nhiệm vụ của hàm là gì.
- Tham số đầu vào (`@param`).
- Giá trị trả về (`@returns`).
- Các lỗi có thể ném ra (`@throws`).

*Ví dụ:*
```typescript
/**
 * Xác thực và đổi mã voucher tại một chi nhánh cụ thể.
 * @param code Mã voucher duy nhất cần redeem
 * @param branchId ID chi nhánh thực hiện quét mã
 * @returns Thông tin lịch sử sử dụng vừa được ghi nhận
 * @throws BadRequestException nếu mã đã dùng hoặc chi nhánh không được áp dụng
 */
async redeemVoucher(code: string, branchId: string): Promise<VoucherUsageLog> { ... }
```

### 2.2. Chú thích Inline (Chú thích trong dòng code)
Chỉ viết comment ở những đoạn logic đặc thù hoặc nhạy cảm sau đây:
- **Các bước trong database transaction:** Đặc biệt là chỗ dùng khóa dòng (`SELECT FOR UPDATE`) để tránh oversold.
- **Thuật toán tạo mã ngẫu nhiên:** Giải thích cơ chế cryptographically random.
- **Tích hợp cổng thanh toán:** Nơi verify signature của VNPay, Stripe, PayPal.
- **Xử lý múi giờ hoặc định dạng tiền tệ:** Chỗ chuyển đổi tiền tệ VND -> USD cho PayPal.

*Ví dụ:*
```typescript
// Bước 1: Khóa dòng dữ liệu chiến dịch để đảm bảo không bị cập nhật đồng thời
const campaign = await tx.voucher_Campaigns.findUnique({
  where: { id: campaignId },
  select: { capacity: true, soldQuantity: true, reservedStock: true }
});

// Bước 2: Kiểm tra tồn kho thực tế (còn lại = sức chứa - đã bán - đã giữ chỗ)
const available = campaign.capacity - (campaign.soldQuantity + campaign.reservedStock);
if (available < quantity) {
  throw new Error('Sản phẩm đã hết hàng');
}
```

---

## 3. Quy Tắc Đối Với Backend (NestJS & Prisma)

- **DTO & Validation rõ ràng:** Mọi dữ liệu đầu vào từ Client phải được định nghĩa bằng DTO (`class-validator`) và chú thích rõ ràng mục đích của từng thuộc tính.
- **Quản lý lỗi tập trung:** Sử dụng các exception có sẵn của NestJS (`BadRequestException`, `NotFoundException`, `ForbiddenException`) thay vì trả về status code thủ công, giúp API trả lỗi đồng bộ.
- **Đặt tên file theo chuẩn NestJS:** `[tên-module].[loại-file].ts` (ví dụ: `vouchers.controller.ts`, `vouchers.service.ts`).

---

## 4. Quy Tắc Đối Với Frontend (Next.js & React)

- **Tách biệt Component:** Giữ trang chính (`page.tsx`) ở dạng Server Component để fetch data. Các phần tương tác (như form, nút bấm, giỏ hàng) viết thành Client Component riêng (`"use client"`).
- **Xử lý State tối giản:** Sử dụng `useState` và `useContext` của React cho việc lưu trạng thái giỏ hàng và auth. Không đưa thêm các thư viện quản lý state phức tạp như Redux vào dự án trừ khi được sự thống nhất của cả nhóm.
- **Validation form đồng bộ:** Sử dụng `react-hook-form` kết hợp `zod` để định nghĩa schema validation trùng khớp với logic DTO của backend.

---

## 5. Quy Trình Git & Commit

- Đặt tên commit ngắn gọn, rõ ràng theo cấu trúc: `[Phân hệ] Nội dung thay đổi`
  *Ví dụ:* `[Auth] Thêm API đăng nhập bằng JWT và mã hóa mật khẩu` hoặc `[UI-Catalog] Thiết kế trang chi tiết voucher responsive`.
- Đảm bảo mỗi commit đều có thể chạy được (không chứa lỗi cú pháp hoặc lỗi build làm gián đoạn các thành viên khác).

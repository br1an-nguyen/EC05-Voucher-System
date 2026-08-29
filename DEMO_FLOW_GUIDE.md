# Bản đồ demo cổng Đối tác

Tài liệu này là “phao” để demo từ đầu đến cuối các chức năng trong sidebar của tài khoản **PARTNER**.

## Phạm vi

Demo sáu flow sau:

1. Dashboard
2. Hồ sơ đối tác
3. Chi nhánh cửa hàng
4. Danh sách Voucher
5. Khiếu nại khách hàng
6. Quản lý Nhân viên

**Không thuộc phạm vi demo:** `Quét/Xác thực mã` (`/partner/redeem`). Mã liên quan đến trang này không được chỉnh sửa cho mục đích tài liệu demo.

## Cách tìm code thật nhanh khi bị hỏi

1. Trong VS Code, nhấn `Ctrl+P` và dán đường dẫn ở cột **UI** hoặc **Vị trí code** của flow tương ứng.
2. Trong file đó, dùng `Ctrl+F` tìm tên hàm được liệt kê, ví dụ `deleteBranch` hoặc `getDashboard`.
3. Nếu cần lần theo dữ liệu, mở controller và service được liệt kê ngay dòng dưới.

Luồng kỹ thuật chung:

```text
Người dùng thao tác trên trang Next.js
        ↓ apiRequest(...)
NestJS Controller (route + phân quyền)
        ↓
Service (quy tắc nghiệp vụ + Prisma/transaction)
        ↓
PostgreSQL qua Prisma models
```

Menu của toàn bộ cổng Đối tác nằm ở:
`apps/web/app/(partner)/partner/layout.tsx`.

## Thứ tự demo đề xuất

| Bước | Flow | Mục tiêu nói ngắn gọn |
| --- | --- | --- |
| 1 | Dashboard | Xem hiệu quả kinh doanh tổng quan. |
| 2 | Hồ sơ đối tác | Cập nhật thông tin doanh nghiệp. |
| 3 | Chi nhánh cửa hàng | Khai báo nơi áp dụng voucher. |
| 4 | Quản lý Nhân viên | Gán nhân viên vào chi nhánh để vận hành. |
| 5 | Danh sách Voucher | Tạo, sửa, gửi duyệt và quản trị chiến dịch. |
| 6 | Khiếu nại khách hàng | Theo dõi và phản hồi vụ việc. |

## 1. Dashboard

**Demo trên UI:** vào `/partner`, giới thiệu các KPI, rồi chuyển trang bảng “Hiệu quả Chiến dịch Voucher”.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI | `apps/web/app/(partner)/partner/page.tsx` | `PartnerDashboard`, hai `useEffect` tải KPI và danh sách chiến dịch. |
| API | `GET /partners/dashboard` | `PartnersController.getDashboard`. |
| Nghiệp vụ | `apps/api/src/partners/partners.service.ts` → `getDashboard` | Truy vấn tổng hợp KPI theo `partnerId` đang đăng nhập. |
| API bảng chiến dịch | `GET /vouchers/partner/list` | `VouchersController.getPartnerCampaigns` → `VouchersService.getPartnerCampaigns`. |
| Dữ liệu | `Partners`, `Voucher_Campaigns`, `Order_Items`, `Orders`, `Voucher_Codes` | Nguồn của số chiến dịch, doanh số, khách hàng, doanh thu và số mã đã sử dụng. |

**Nếu bị hỏi “số liệu này ở đâu ra?”**

> Frontend chỉ hiển thị dữ liệu. Các KPI được tổng hợp theo đối tác đăng nhập trong `PartnersService.getDashboard`; bảng chiến dịch dùng `VouchersService.getPartnerCampaigns`.

## 2. Hồ sơ đối tác

**Demo trên UI:** vào `/partner/profile`, sửa tên công ty/đại diện (dùng dữ liệu demo an toàn), lưu và chỉ thông báo thành công.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI | `apps/web/app/(partner)/partner/profile/page.tsx` | `loadProfile` gọi GET; `onSubmit` gọi PATCH. |
| API | `GET`, `PATCH /partners/profile` | `PartnersController.getProfile` và `updateProfile`; chỉ role `PARTNER` được gọi. |
| Nghiệp vụ | `PartnersService.getProfile`, `updateProfile` | Lấy/cập nhật hồ sơ của chính `req.user.userId`; chặn mã số thuế bị trùng. |
| Dữ liệu | `Partners`, `Users` | Hồ sơ doanh nghiệp và thông tin tài khoản liên quan. |

**Nếu bị hỏi về bảo mật/quyền:**

> Không nhận `partnerId` từ form. Controller lấy ID từ JWT của tài khoản đăng nhập và giới hạn bằng `@Roles(UserRole.PARTNER)`.

## 3. Chi nhánh cửa hàng

**Demo trên UI:** vào `/partner/branches`, tìm kiếm, tạo một chi nhánh, sửa và chỉ thử xóa một chi nhánh không có ràng buộc.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI | `apps/web/app/(partner)/partner/branches/page.tsx` | `loadBranches`, `onSubmit`, `handleDelete`. |
| API | `GET /partners/branches/list`, `GET /partners/provinces` | Danh sách phân trang và danh mục tỉnh/thành. |
| API ghi dữ liệu | `POST`, `PATCH`, `DELETE /partners/branches...` | `PartnersController.createBranch`, `updateBranch`, `deleteBranch`. |
| Nghiệp vụ | `PartnersService.listBranches`, `createBranch`, `updateBranch`, `deleteBranch` | Kiểm tra chi nhánh có thuộc đúng đối tác; khi xóa chặn ràng buộc nghiệp vụ. |
| Dữ liệu | `Branches`, `Campaign_Branches`, `Users` | Chi nhánh; liên kết với chiến dịch; nhân viên được gán chi nhánh. |

**Nếu bị hỏi “tại sao không xóa được?”**

> `PartnersService.deleteBranch` chặn xóa nếu chi nhánh còn liên kết với chiến dịch voucher hoặc vẫn có nhân viên trực thuộc. Đây là để không làm mất quan hệ vận hành còn hiệu lực.

## 4. Danh sách Voucher

**Demo trên UI:** vào `/partner/vouchers`, lọc/tìm kiếm, tạo voucher nháp, sửa nháp, gửi duyệt, rồi xem chi tiết. Với chiến dịch đã được duyệt có thể minh họa ngừng bán/mở bán lại. Trang chi tiết có quản trị khóa/mở khóa mã; đây là quản trị mã, **không phải flow Quét/Xác thực mã**.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI danh sách | `apps/web/app/(partner)/partner/vouchers/page.tsx` | `loadCampaigns`, `handleSubmitForApproval`, `handleStatusAction`. |
| UI form tạo/sửa | `apps/web/app/(partner)/partner/vouchers/components/VoucherCampaignForm.tsx` | Nạp chi nhánh, tính giá giảm và `onSubmit`. |
| UI route | `.../vouchers/new/page.tsx`, `.../vouchers/[id]/edit/page.tsx` | Cùng dùng `VoucherCampaignForm`; có `campaignId` là sửa, không có là tạo. |
| UI chi tiết | `apps/web/app/(partner)/partner/vouchers/[id]/page.tsx` | `loadCampaign`, `loadCodes`, `handleCodeAction`. |
| API | `POST/PATCH /vouchers`, `POST /vouchers/:id/submit`, `GET /vouchers/partner/...`, `PATCH /vouchers/partner/:id/status` | `VouchersController`. |
| Nghiệp vụ | `VouchersService.create`, `update`, `submitForApproval`, `getPartnerCampaigns`, `getPartnerCampaignDetail`, `getPartnerVoucherCodes`, `updatePartnerCampaignStatus` | Kiểm tra quyền sở hữu, giá, thời gian, trạng thái và chi nhánh áp dụng. |
| Khóa mã | `PATCH /vouchers/codes/:codeId/lock` hoặc `/unlock` | `VouchersService.lockVoucherCode`, `unlockVoucherCode`; có ghi audit log. |
| Dữ liệu | `Voucher_Campaigns`, `Campaign_Branches`, `Voucher_Codes`, `Order_Items`, `Activity_Logs` | Chiến dịch, nơi áp dụng, mã đã phát hành, đơn hàng và dấu vết quản trị. |

**Các câu trả lời ngắn quan trọng:**

- **“Vì sao chỉ sửa được nháp/từ chối?”** — `VouchersService.update` chỉ cho `DRAFT` hoặc `REJECTED`, để không sửa nội dung đã qua quy trình xét duyệt.
- **“Vì sao giá sale phải nhỏ hơn giá gốc?”** — được kiểm tra ở backend theo quy tắc `RB-02`, không chỉ dựa vào validation frontend.
- **“Làm sao biết voucher dùng ở đâu?”** — chiến dịch lưu các chi nhánh áp dụng trong bảng trung gian `Campaign_Branches`; service xác thực các chi nhánh phải thuộc đối tác.
- **“Đổi trạng thái thế nào?”** — đối tác chỉ được `APPROVED → PAUSED` hoặc `PAUSED → APPROVED`; các trạng thái khác bị chặn ở service.

## 5. Khiếu nại khách hàng

**Demo trên UI:** vào `/partner/complaints`, lọc vụ việc chờ phản hồi, mở chi tiết để xem hội thoại/lịch sử, nhập phản hồi và gửi.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI | `apps/web/app/(partner)/partner/complaints/page.tsx` | `load`, `openDetail`, `sendReply`. |
| API | `GET /complaints/partner/list`, `GET /complaints/partner/:id`, `POST /complaints/partner/:id/messages` | `ComplaintsController`. |
| Nghiệp vụ | `ComplaintsService.findPartnerComplaints`, `findPartnerComplaintDetail`, `partnerReply`, `partyReply` | Chỉ cho đối tác xem vụ việc của mình; kiểm tra lượt phản hồi và xử lý trong transaction. |
| Dữ liệu | `Complaints`, `Complaint_Messages`, `Complaint_Events`, `Activity_Logs` | Nội dung vụ việc, hội thoại, lịch sử chuyển trạng thái và audit log. |

**Nếu bị hỏi “làm sao tránh hai người phản hồi chồng nhau?”**

> Frontend gửi `expectedVersion`. `partyReply` dùng transaction và cập nhật có điều kiện theo `version`; nếu bản ghi vừa bị cập nhật, backend trả lỗi để tải lại dữ liệu mới.

## 6. Quản lý Nhân viên

**Demo trên UI:** vào `/partner/staff`, lọc danh sách, tạo tài khoản nhân viên và gán một chi nhánh, sửa thông tin hoặc xóa một tài khoản demo.

| Tầng | Vị trí code | Điểm cần chỉ |
| --- | --- | --- |
| UI | `apps/web/app/(partner)/partner/staff/page.tsx` | `loadStaff`, tải chi nhánh, `onCreateSubmit`, `onEditSubmit`, `handleDeleteStaff`. |
| API | `GET/POST /partners/staff`, `PATCH/DELETE /partners/staff/:id` | `PartnersController`. |
| Nghiệp vụ | `PartnersService.listStaff`, `createStaff`, `updateStaff`, `deleteStaff` | Kiểm tra chi nhánh thuộc đối tác, email/số điện thoại không trùng, mã hóa mật khẩu. |
| Dữ liệu | `Users`, `Branches`, `Partners` | User có role `PARTNER_STAFF`, được gán `branchId` và `partnerId`. |

**Nếu bị hỏi về tài khoản nhân viên:**

> Khi tạo, backend xác minh chi nhánh thực sự thuộc đối tác, kiểm tra trùng email/số điện thoại, sau đó mã hóa mật khẩu bằng `bcrypt` và tạo user role `PARTNER_STAFF`.

## Kiểm tra nhanh trước khi demo

- Đăng nhập đúng tài khoản role `PARTNER` đã được Admin phê duyệt.
- Có tối thiểu một chi nhánh trước khi tạo voucher hoặc nhân viên.
- Chuẩn bị một voucher `DRAFT` để demo sửa/gửi duyệt và một voucher `APPROVED` nếu muốn demo tạm dừng/mở lại.
- Chuẩn bị một khiếu nại ở trạng thái `WAITING_PARTNER` nếu muốn gửi phản hồi.
- Không thao tác menu `/partner/redeem` trong buổi demo này.

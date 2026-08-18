Kế hoạch Đại tu UI/UX Frontend (E-Commerce Style)
Theo yêu cầu của bạn, tôi sẽ tiến hành đại tu lại toàn bộ giao diện (UI) và trải nghiệm người dùng (UX) của Frontend để hệ thống trông chuyên nghiệp, bắt mắt và mang đậm chất của một sàn Thương Mại Điện Tử (như Shopee, Lazada, Tiki) hơn. Việc sửa đổi này sẽ tuân thủ nghiêm ngặt nguyên tắc "Rich Aesthetics" và "Dynamic Design".

Tạm thời không đụng đến Backend, chỉ focus vào Frontend (apps/web).

User Review Required
IMPORTANT

Đây là một bản cập nhật lớn về mặt giao diện. Hãy xem qua định hướng thiết kế dưới đây. Nếu bạn đồng ý với hướng đi này, hãy nhấn Proceed để tôi bắt đầu code.

Open Questions
NOTE

Bạn có muốn tích hợp thêm Dark Mode (chế độ tối) cho sàn thương mại điện tử này không, hay chỉ giữ tông sáng (Light Mode) cho sạch sẽ và dễ nhìn?
Bạn có muốn tôi sử dụng thêm thư viện framer-motion để xử lý các hiệu ứng chuyển động mượt mà (micro-animations) không?
Proposed Changes (Chi tiết Kế hoạch)
1. Nâng cấp Hệ thống Design System (trong globals.css)
Bảng màu (Color Palette):
Thay đổi màu primary sang tông cam/đỏ rực rỡ và hiện đại hơn (ví dụ: Gradient từ #FF512F sang #DD2476 hoặc sử dụng mã màu #EE4D2D đặc trưng của Shopee).
Background sử dụng tông màu xám cực nhạt (#F5F5F5) làm nổi bật các Card sản phẩm trắng.
Typography: Tiếp tục dùng Manrope nhưng tinh chỉnh lại Line Height và Font Weight để nội dung rõ ràng hơn.
2. Thiết kế lại Layout Chính (layout.tsx & page.tsx)
Header chuyên nghiệp:
Cố định trên cùng (Sticky).
Tích hợp thanh Search Bar lớn ở chính giữa màn hình (như các sàn TMĐT).
Cải tiến khu vực Giỏ hàng (Cart) và User Profile với Dropdown menu thay vì nút bấm rời rạc.
Thêm hiệu ứng Glassmorphism (kính mờ) khi cuộn trang.
Hero Banner Động:
Thay thế khối text hiện tại bằng một Banner nổi bật (có thể dạng Slider/Carousel) với màu sắc bắt mắt, thu hút người dùng săn voucher ngay lập tức.
Bộ lọc (Sidebar Filters):
Đưa vào các khối (Card) gọn gàng.
Sử dụng Checkbox/Radio có custom UI.
Lưới Sản phẩm (Product Grid):
Làm mới Voucher Card với hiệu ứng hover nổi lên (lift up), đổ bóng (shadow) mượt mà.
Badge giảm giá (Discount Badge) góc cạnh, màu đỏ rực.
Thanh hiển thị tiến độ "Đã bán" (Progress bar) trực quan.
3. Tổ chức lại Components
Thay vì viết toàn bộ vào page.tsx, tôi sẽ bóc tách các thành phần UI ra thư mục apps/web/components/ để dễ tái sử dụng:

Header.tsx
HeroBanner.tsx
VoucherCard.tsx
FilterSidebar.tsx
Verification Plan
Automated Tests
Kiểm tra build tĩnh của Next.js bằng lệnh npm run build trong apps/web.
Manual Verification
Khởi chạy frontend (npm run dev) và kiểm tra trên trình duyệt:
Responsive trên thiết bị di động (Mobile) và PC.
Các hiệu ứng hover, transition có hoạt động mượt mà không.
Đảm bảo logic filter và fetch API cũ không bị hỏng sau khi tái cấu trúc UI.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Hàm gọi API chung (fetch wrapper) hỗ trợ tự động đính kèm Access Token 
 * và cơ chế tự động xoay vòng (refresh) token khi nhận lỗi 401 Unauthorized.
 * @param endpoint Đường dẫn API endpoint (vd: '/auth/login')
 * @param options Cấu hình RequestInit
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});
  
  // Bước 1: Đọc Access Token từ localStorage để chèn vào Header Authorization
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Mặc định thiết lập Content-Type là JSON nếu không upload file
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  let response = await fetch(`${API_URL}${endpoint}`, config);

  // Bước 2: Xử lý tự động Refresh Token nếu nhận mã lỗi 401 (Access Token hết hạn)
  if (response.status === 401 && typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      try {
        // Gọi API refresh token lên NestJS backend
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          
          // Lưu cặp tokens mới vào localStorage
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          // Cập nhật lại header Authorization với token mới và gửi lại request ban đầu
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
          });
        } else {
          // Nếu refresh token cũng hết hạn, tiến hành đăng xuất người dùng
          logoutUser();
        }
      } catch (err) {
        console.error('Lỗi kết nối khi tự động làm mới token:', err);
        logoutUser();
      }
    }
  }

  // Bước 3: Xử lý lỗi từ server
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Lỗi từ hệ thống (Mã: ${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Xóa thông tin đăng nhập và chuyển hướng về trang Login.
 */
function logoutUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Chỉ chuyển hướng nếu đang không nằm ở trang login/register để tránh lặp vô tận
    const path = window.location.pathname;
    if (path !== '/login' && path !== '/register') {
      window.location.href = '/login';
    }
  }
}

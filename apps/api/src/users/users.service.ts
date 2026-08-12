import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserStatus } from '@prisma/client';

/**
 * Service quản lý người dùng (Users), bao gồm các thao tác tìm kiếm,
 * khởi tạo và cập nhật trạng thái hoạt động của tài khoản.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tìm kiếm người dùng bằng email duy nhất.
   * @param email Địa chỉ email cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Tìm kiếm người dùng bằng số điện thoại duy nhất.
   * @param phone Số điện thoại cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Tìm kiếm người dùng bằng mã định danh (user_id).
   * @param userId ID duy nhất của người dùng
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { userId },
    });
  }

  /**
   * Tạo tài khoản người dùng mới (đáp ứng điều kiện kiểm tra dữ liệu đầu vào DTO).
   * @param data Đối tượng chứa thông tin khởi tạo tài khoản
   * @returns Bản ghi User vừa được khởi tạo thành công
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Cập nhật trạng thái hoạt động (ACTIVE/LOCKED) của người dùng.
   * Thường được gọi bởi các API quản trị hệ thống (Admin).
   * @param userId ID người dùng cần cập nhật
   * @param status Trạng thái mới cần áp dụng
   * @returns Bản ghi User sau khi cập nhật
   */
  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { userId },
      data: { status },
    });
  }
}

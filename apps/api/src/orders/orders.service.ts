import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderStatus, PaymentStatus, ReservationStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo đơn hàng từ giỏ hàng hiện tại của khách hàng.
   * Sử dụng khóa dòng SELECT FOR UPDATE (Concurrency Row Locking) để chống bán lố (Oversold).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param dto DTO chứa thông tin cổng thanh toán và ghi chú
   * @returns Đơn hàng vừa tạo
   */
  async checkout(customerId: string, dto: CheckoutDto) {
    // Bước 1: Lấy giỏ hàng của khách hàng
    const cartItems = await this.prisma.cartItem.findMany({
      where: { customerId },
      include: { campaign: true },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng của bạn đang trống.');
    }

    // Khởi chạy database transaction để đảm bảo tính nguyên tử (Atomicity)
    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      // Bước 2: Duyệt qua từng sản phẩm trong giỏ hàng để khóa dòng (SELECT FOR UPDATE)
      for (const item of cartItems) {
        // Thực hiện khóa dòng chiến dịch voucher tại DB để tránh tranh chấp từ các luồng khác
        await tx.$executeRawUnsafe(
          `SELECT campaign_id FROM "Voucher_Campaigns" WHERE campaign_id = $1::uuid FOR UPDATE`,
          item.campaignId,
        );

        // Lấy thông tin voucher mới nhất sau khi đã khóa dòng thành công
        const campaign = await tx.voucherCampaign.findUnique({
          where: { campaignId: item.campaignId },
        });

        if (!campaign) {
          throw new NotFoundException(`Chiến dịch voucher không tồn tại.`);
        }

        // Bước 3: Kiểm tra tồn kho thực tế (Sức chứa - Đã bán - Đang giữ chỗ)
        const available = campaign.capacity - (campaign.soldQuantity + campaign.reservedStock);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" không đủ số lượng trong kho (Còn lại: ${available}).`,
          );
        }

        // Tích lũy tổng tiền của đơn hàng
        totalAmount += Number(campaign.salePrice) * item.quantity;
      }

      // Bước 4: Tăng số lượng giữ chỗ (reservedStock) cho từng chiến dịch voucher
      for (const item of cartItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            reservedStock: { increment: item.quantity },
          },
        });
      }

      // Bước 5: Khởi tạo đơn hàng (Order) ở trạng thái PENDING & UNPAID
      const orderCode = `ORD${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // Giữ chỗ trong 15 phút (RB-15)

      const order = await tx.order.create({
        data: {
          orderCode,
          customerId,
          recipientNote: dto.recipientNote,
          totalAmount,
          selectedPaymentProvider: dto.paymentProvider,
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          reservationExpiresAt,
        },
      });

      // Bước 6: Thêm các chi tiết đơn hàng (OrderItem) và tạo phiếu giữ chỗ (InventoryReservation)
      for (const item of cartItems) {
        // Tạo chi tiết đơn hàng
        await tx.orderItem.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            unitPrice: item.campaign.salePrice,
          },
        });

        // Tạo bản ghi giữ chỗ tồn kho (InventoryReservation)
        await tx.inventoryReservation.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            status: ReservationStatus.ACTIVE,
            expiresAt: reservationExpiresAt,
          },
        });
      }

      // Bước 7: Xóa giỏ hàng của khách hàng sau khi tạo đơn hàng thành công
      await tx.cartItem.deleteMany({
        where: { customerId },
      });

      return order;
    });
  }

  /**
   * Xem danh sách lịch sử đơn hàng của một khách hàng cụ thể.
   * @param customerId ID khách hàng
   */
  async getCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              select: { title: true, category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Xem chi tiết một đơn hàng của khách hàng.
   * @param customerId ID khách hàng sở hữu
   * @param orderId ID đơn hàng cần xem
   */
  async getOrderDetails(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderId, customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              include: {
                partner: {
                  select: { companyName: true },
                },
              },
            },
          },
        },
        paymentTransactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    return order;
  }
}

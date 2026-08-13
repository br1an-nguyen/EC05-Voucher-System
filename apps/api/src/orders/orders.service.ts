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

  /**
   * Yêu cầu hoàn tiền và hủy đơn hàng (Refund logic - MVP hỗ trợ hoàn tiền toàn bộ).
   * Ràng buộc: Chỉ hoàn tiền khi toàn bộ mã voucher trong đơn hàng chưa được sử dụng.
   * @param customerId ID khách hàng yêu cầu hoàn tiền
   * @param orderId ID đơn hàng cần hoàn tiền
   */
  async requestRefund(customerId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tìm đơn hàng và khóa dòng để đảm bảo nhất quán
      await tx.$executeRawUnsafe(
        `SELECT order_id FROM "Orders" WHERE order_id = $1::uuid FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: {
          orderItems: true,
          paymentTransactions: {
            where: { status: 'SUCCEEDED' },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu hoàn tiền.');
      }

      // Ràng buộc: Đơn hàng phải đã thanh toán thành công
      if (order.paymentStatus !== PaymentStatus.PAID || order.orderStatus !== OrderStatus.CONFIRMED) {
        throw new BadRequestException('Chỉ có thể hoàn tiền cho các đơn hàng đã thanh toán thành công.');
      }

      const payment = order.paymentTransactions[0];
      if (!payment) {
        throw new BadRequestException('Không tìm thấy giao dịch thanh toán thành công liên kết.');
      }

      // 2. Tìm toàn bộ các mã voucher đã phát hành từ đơn hàng này
      const voucherCodes = await tx.voucherCode.findMany({
        where: {
          orderItem: { orderId: order.orderId },
        },
      });

      // Ràng buộc (RB-14): Nếu có bất kỳ mã voucher nào đã dùng (status === USED), từ chối hoàn tiền
      const hasUsedCode = voucherCodes.some((vc) => vc.status === 'USED');
      if (hasUsedCode) {
        throw new BadRequestException('Không thể hoàn tiền vì đã có ít nhất một mã voucher trong đơn hàng đã được sử dụng.');
      }

      // 3. Hủy bỏ tất cả các mã voucher chưa dùng (chuyển sang CANCELLED)
      await tx.voucherCode.updateMany({
        where: {
          orderItem: { orderId: order.orderId },
          status: 'AVAILABLE',
        },
        data: { status: 'CANCELLED' },
      });

      // 4. Khởi tạo bản ghi hoàn tiền PaymentRefund
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.paymentId,
          amountMinor: payment.requestAmountMinor,
          currency: payment.requestCurrency,
          status: 'SUCCEEDED', // Giả lập thành công từ nhà cung cấp
          idempotencyKey: `REFUND-${order.orderId}-${Date.now()}`,
          reason: 'Khách hàng tự hủy và yêu cầu hoàn tiền trực tuyến.',
        },
      });

      // 5. Cập nhật trạng thái đơn hàng thành CANCELLED và trạng thái thanh toán thành REFUNDED
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      // 6. Hoàn lại số lượng tồn kho của voucher chiến dịch (giảm soldQuantity)
      for (const item of order.orderItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            soldQuantity: { decrement: item.quantity },
          },
        });
      }

      return updatedOrder;
    });
  }
}

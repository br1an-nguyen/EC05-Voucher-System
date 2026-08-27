import './../src/config/load-env';
import { PrismaClient, OrderStatus, PaymentStatus, PaymentTransactionStatus, VoucherCodeStatus, PaymentRefundStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as crypto from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Bắt đầu sinh lịch sử giao dịch, hoàn tiền và đánh giá mẫu phong phú...");

  // Dọn dẹp các đơn hàng, giao dịch, và review demo cũ bằng CASCADE để tránh lỗi khóa ngoại
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Voucher_Usage_Log",
      "Voucher_Codes",
      "Payment_Refunds",
      "Payment_Transactions",
      "Order_Items",
      "Orders",
      "Voucher_Reviews"
    CASCADE;
  `);

  const oneMonthAgoForSale = new Date();
  oneMonthAgoForSale.setMonth(oneMonthAgoForSale.getMonth() - 1);
  const oneYearHenceForSale = new Date();
  oneYearHenceForSale.setFullYear(oneYearHenceForSale.getFullYear() + 1);

  console.log("Đang điều chỉnh thời gian mở bán của tất cả campaigns về quá khứ...");
  await prisma.voucherCampaign.updateMany({
    data: {
      saleStartTime: oneMonthAgoForSale,
      saleEndTime: oneYearHenceForSale,
    }
  });

  // 1. Lấy tất cả voucher Giftpop đã được import kèm brand của nó
  const giftpopCampaigns = await prisma.voucherCampaign.findMany({
    where: { externalSource: "giftpop.vn" },
    include: {
      campaignBrands: {
        include: {
          brand: true
        }
      }
    }
  });

  // Lấy tất cả các chi nhánh thật đã được seed
  const realBranches = await prisma.branch.findMany();

  console.log(`Đang gán chi nhánh thật cho ${giftpopCampaigns.length} voucher Giftpop...`);
  
  // Dọn dẹp liên kết chi nhánh cũ của các voucher Giftpop
  await prisma.campaignBranch.deleteMany({
    where: {
      campaign: {
        externalSource: "giftpop.vn",
      },
    },
  });

  for (const camp of giftpopCampaigns) {
    const brandName = camp.campaignBrands[0]?.brand?.displayName?.toLowerCase() || "";
    let matchedBranches: typeof realBranches = [];

    if (brandName.includes("cộng") || brandName.includes("cong")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Cộng Cà Phê"));
    } else if (brandName.includes("highlands")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Highlands"));
    } else if (brandName.includes("cgv")) {
      matchedBranches = realBranches.filter(b => b.name.includes("CGV"));
    } else if (brandName.includes("grab")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Grab"));
    } else if (brandName.includes("tous") || brandName.includes("jours")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Tous les Jours"));
    } else if (brandName.includes("4p")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Pizza 4P"));
    } else if (brandName.includes("lotteria")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Lotteria"));
    } else if (brandName.includes("dottie")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Dottie"));
    } else if (brandName.includes("tôm") || brandName.includes("tom")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Bác Tôm"));
    } else if (brandName.includes("k-market") || brandName.includes("kmarket")) {
      matchedBranches = realBranches.filter(b => b.name.includes("K-Market"));
    } else if (brandName.includes("coco") || brandName.includes("spa")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Coco Spa"));
    } else if (brandName.includes("h plus") || brandName.includes("hplus")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Y Tế H Plus"));
    } else if (brandName.includes("smile") || brandName.includes("beauty") || brandName.includes("nha khoa")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Smile Beauty"));
    } else if (brandName.includes("lotte") && brandName.includes("cinema")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Lotte Cinema"));
    } else if (brandName.includes("life4cuts") || brandName.includes("life 4 cuts")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Life4cuts"));
    } else if (brandName.includes("extrim")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Extrim"));
    } else if (brandName.includes("go2joy")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Go2Joy"));
    } else if (brandName.includes("hoa yêu thương") || brandName.includes("hoa yeu thuong")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Hoa Yêu Thương"));
    } else if (brandName.includes("westway")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Westway"));
    } else if (brandName.includes("suối tiên") || brandName.includes("suoi tien")) {
      matchedBranches = realBranches.filter(b => b.name.includes("Suối Tiên"));
    } else {
      matchedBranches = [];
    }

    for (const branch of matchedBranches) {
      await prisma.campaignBranch.create({
        data: {
          partnerId: camp.partnerId,
          campaignId: camp.campaignId,
          branchId: branch.branchId,
        },
      });
    }
  }

  // 2. Lấy danh sách khách hàng và các chiến dịch voucher APPROVED
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
  });

  const campaigns = await prisma.voucherCampaign.findMany({
    where: { status: "APPROVED" },
    include: {
      campaignBranches: true,
    },
  });

  if (customers.length === 0) {
    console.error("Không tìm thấy khách hàng nào trong DB để seed đơn hàng.");
    return;
  }

  if (campaigns.length === 0) {
    console.error("Không tìm thấy chiến dịch APPROVED nào trong DB. Vui lòng chạy import trước.");
    return;
  }

  console.log(`Đã tìm thấy ${customers.length} khách hàng và ${campaigns.length} chiến dịch voucher hoạt động.`);

  // 3. Định nghĩa các bình luận mẫu theo danh mục cực kỳ thực tế
  const commentsMap: Record<string, { rating: number, text: string }[]> = {
    "A101": [ // Cà phê - Trà
      { rating: 5, text: "Cà phê ngon, không gian ấm cúng. Nhân viên quét mã nhanh nhẹn!" },
      { rating: 5, text: "Trà đào thanh mát cực kỳ thích hợp cho mùa hè. Voucher dùng siêu tiện lợi." },
      { rating: 4, text: "Nước uống ngon nhưng quán giờ cao điểm hơi đông, phải đợi order tí." }
    ],
    "A106": [ // Gà rán & Thức ăn nhanh
      { rating: 5, text: "Burger gà giòn ngon, nước ngọt mát lạnh. Đổi voucher tại quầy Lotteria rất mượt." },
      { rating: 4, text: "Mỳ Ý sốt bò bằm đậm đà, khoai tây chiên giòn. Điểm cộng cho nhân viên lịch sự." }
    ],
    "A107": [ // Pizza
      { rating: 5, text: "Pizza 4P's thì đỉnh rồi, phô mai béo ngậy. Voucher giảm giá tiết kiệm được nhiều." },
      { rating: 4, text: "Pizza nướng củi thơm phức, không gian sang trọng rất thích hợp hẹn hò." }
    ],
    "A108": [ // Thời trang
      { rating: 5, text: "Đồ Dottie thiết kế trẻ trung, chất vải dày dặn mát mẻ. Quét code giảm giá thành công ngay." },
      { rating: 4, text: "Nhiều mẫu váy xinh, nhân viên tư vấn nhiệt tình. Sẽ tiếp tục săn voucher." }
    ],
    "A110": [ // Spa
      { rating: 5, text: "Coco Spa làm dịch vụ tốt lắm, massage thư giãn dễ chịu, nhân viên tay nghề cao." },
      { rating: 5, text: "Trải nghiệm trị liệu xông hơi rất sảng khoái, không gian thơm mùi tinh dầu." }
    ],
    "A112": [ // Nha khoa
      { rating: 5, text: "Phòng khám nha khoa sạch sẽ, bác sĩ nhẹ nhàng và tư vấn rất tận tâm." },
      { rating: 4, text: "Lấy cao răng sạch, không ê buốt. Voucher giá hời." }
    ],
    "A115": [ // Rạp chiếu phim
      { rating: 5, text: "Rạp CGV màn hình rộng âm thanh cực sống động. Đổi vé bắp nước nhanh chóng." },
      { rating: 5, text: "Mua voucher combo bắp nước xem phim siêu tiết kiệm. Rất đáng tiền." }
    ],
    "A117": [ // Siêu thị & Cửa hàng tiện lợi
      { rating: 5, text: "K-Market nhiều đồ ăn vặt Hàn Quốc nhập khẩu. Quét mã thanh toán mất 3 giây." },
      { rating: 4, text: "Bác Tôm rau củ quả tươi sạch an toàn. Dịch vụ thanh toán bằng voucher ổn định." }
    ],
    "default": [
      { rating: 5, text: "Giao dịch an toàn, tiện lợi. Voucher áp dụng tốt và đúng mô tả." },
      { rating: 4, text: "Dịch vụ chăm sóc khách hàng tốt, nhận code ngay sau khi trả tiền." }
    ]
  };

  const reviewedPairs = new Set<string>();
  const paymentProviders = ["STRIPE", "PAYPAL", "MOMO"];
  const now = new Date();

  // Sinh 50 đơn hàng rải rác trong 30 ngày gần đây
  const TOTAL_ORDERS = 50;
  console.log(`Bắt đầu sinh ${TOTAL_ORDERS} đơn hàng mẫu phong phú...`);

  for (let i = 1; i <= TOTAL_ORDERS; i++) {
    const customer = customers[i % customers.length];
    const provider = paymentProviders[i % paymentProviders.length];
    
    // Rải rác ngày tạo từ 30 ngày trước đến nay
    const daysAgo = 30 - (i * 30) / TOTAL_ORDERS;
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const reservationExpiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);

    // Xác định trạng thái đơn hàng (Đa dạng hóa luồng)
    let orderStatus: OrderStatus = "CONFIRMED";
    let paymentStatus: PaymentStatus = "PAID";
    
    if (i === 15 || i === 30 || i === 45) {
      // Flow hoàn tiền (REFUNDED)
      orderStatus = "CONFIRMED";
      paymentStatus = "REFUNDED";
    } else if (i === 10 || i === 25) {
      // Flow chờ thanh toán (PENDING)
      orderStatus = "PENDING";
      paymentStatus = "UNPAID";
    } else if (i === 20 || i === 40) {
      // Flow bị hủy (CANCELLED)
      orderStatus = "CANCELLED";
      paymentStatus = "UNPAID";
    }

    const isGift = i % 8 === 0;
    const recipientEmail = isGift ? `recipient_demo_${i}@gmail.com` : null;
    const recipientNote = isGift ? "Chúc bạn có những trải nghiệm thật tuyệt vời!" : null;

    // Chọn ngẫu nhiên 1 hoặc 2 voucher cho đơn hàng này
    const orderCampaigns = [
      campaigns[i % campaigns.length],
    ];
    if (i % 4 === 0 && campaigns.length > 1) {
      orderCampaigns.push(campaigns[(i + 1) % campaigns.length]);
    }

    let totalAmount = 0;
    const itemsData: any[] = [];
    for (const campaign of orderCampaigns) {
      const quantity = (i % 3) + 1; // 1 đến 3 chiếc
      const price = Number(campaign.salePrice);
      totalAmount += price * quantity;
      itemsData.push({ campaign, quantity, price });
    }

    const orderCode = `ORD-${provider}-${1000 + i}`;

    await prisma.$transaction(async (tx) => {
      // 1. Tạo đơn hàng
      const order = await tx.order.create({
        data: {
          orderCode,
          customerId: customer.userId,
          isGift,
          recipientEmail,
          recipientNote,
          totalAmount,
          baseCurrency: "VND",
          selectedPaymentProvider: provider as any,
          orderStatus,
          paymentStatus,
          reservationExpiresAt,
          createdAt,
        },
      });

      // 2. Tạo giao dịch thanh toán nếu là PAID hoặc đã từng PAID (REFUNDED)
      if (paymentStatus === "PAID" || paymentStatus === "REFUNDED") {
        const isUsd = provider === "PAYPAL";
        const exchangeRate = isUsd ? 25000 : null;
        const requestCurrency = isUsd ? "USD" : "VND";
        const requestAmountMinor = isUsd 
          ? BigInt(Math.round((totalAmount / 25000) * 100))
          : BigInt(totalAmount);

        const paymentTx = await tx.paymentTransaction.create({
          data: {
            orderId: order.orderId,
            provider: provider as any,
            attemptNo: 1,
            status: "SUCCEEDED",
            idempotencyKey: `idem-${provider.toLowerCase()}-${order.orderId.substring(0, 8)}`,
            providerOrderId: `ch_${provider.toLowerCase()}_${i}99${i}`,
            providerTransactionId: `txn_${provider.toLowerCase()}_${i}99${i}`,
            baseAmount: totalAmount,
            requestAmountMinor,
            requestCurrency,
            exchangeRate,
            settledAmountMinor: requestAmountMinor,
            settledCurrency: requestCurrency,
            paidAt: createdAt,
            createdAt,
          },
        });

        // Nếu là đơn hàng hoàn tiền, tạo bản ghi PaymentRefund tương ứng
        if (paymentStatus === "REFUNDED") {
          await tx.paymentRefund.create({
            data: {
              paymentId: paymentTx.paymentId,
              providerRefundId: `ref_${provider.toLowerCase()}_${i}88${i}`,
              amountMinor: requestAmountMinor,
              currency: requestCurrency,
              status: "SUCCEEDED" as PaymentRefundStatus,
              idempotencyKey: `idem-ref-${order.orderId.substring(0, 8)}`,
              reason: "Khách hàng yêu cầu hoàn tiền trong thời hạn quy định.",
              createdAt: new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000), // Hoàn sau 1 ngày
            }
          });
        }
      }

      // 3. Tạo các OrderItems và Voucher Codes
      for (const item of itemsData) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaign.campaignId,
            quantity: item.quantity,
            unitPrice: item.price,
            refundAllowedSnapshot: item.campaign.refundAllowed,
            refundWindowHoursSnapshot: item.campaign.refundWindowHours,
            refundPolicySnapshot: item.campaign.refundPolicy,
            cancellationPolicySnapshot: item.campaign.cancellationPolicy,
            policyVersionSnapshot: item.campaign.policyVersion,
          },
        });

        // Tăng số lượng đã bán nếu đơn hàng thành công
        if (orderStatus === "CONFIRMED") {
          await tx.voucherCampaign.update({
            where: { campaignId: item.campaign.campaignId },
            data: {
              soldQuantity: { increment: item.quantity },
            },
          });
        }

        // Tạo mã voucher nếu đơn hàng đã được thanh toán (chỉ áp dụng cho CONFIRMED hoặc REFUNDED)
        if (paymentStatus === "PAID" || paymentStatus === "REFUNDED") {
          for (let q = 0; q < item.quantity; q++) {
            const uniqueCode = `${item.campaign.title.substring(0, 3).replace(/[^a-zA-Z]/g, "").toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
            
            // Quyết định trạng thái voucher code
            // Nếu đơn hàng bị hoàn tiền -> Cả code sẽ có trạng thái CANCELLED
            // Nếu không: 55% đã sử dụng (USED), 30% chưa dùng (AVAILABLE), 15% quá hạn (EXPIRED nếu mua > 20 ngày trước)
            let codeStatus: VoucherCodeStatus = "AVAILABLE";
            if (paymentStatus === "REFUNDED") {
              codeStatus = "CANCELLED";
            } else {
              const rand = Math.random();
              if (rand < 0.55) {
                codeStatus = "USED";
              } else if (rand < 0.7 && daysAgo > 20) {
                codeStatus = "EXPIRED";
              }
            }

            const expiresAt = item.campaign.usageEndTime;

            const voucherCode = await tx.voucherCode.create({
              data: {
                itemId: orderItem.itemId,
                uniqueCode,
                customerId: customer.userId,
                status: codeStatus,
                issuedAt: createdAt,
                expiresAt,
              },
            });

            // Nếu voucher đã sử dụng, tạo log dùng tại chi nhánh tương ứng của thương hiệu
            if (codeStatus === "USED" && item.campaign.campaignBranches.length > 0) {
              const branchRelation = item.campaign.campaignBranches[q % item.campaign.campaignBranches.length];
              await tx.voucherUsageLog.create({
                data: {
                  codeId: voucherCode.codeId,
                  branchId: branchRelation.branchId,
                  usedAt: new Date(createdAt.getTime() + Math.min(daysAgo * 0.5, 3) * 24 * 60 * 60 * 1000), // dùng sau vài ngày mua
                },
              });
            }
          }

          // 4. Tạo đánh giá (Review) logic và chân thực theo danh mục của voucher
          // Chỉ tạo review nếu đơn hàng thành công và voucher đã sử dụng hoặc khả dụng
          if (orderStatus === "CONFIRMED" && i % 2 === 0) {
            const reviewKey = `${customer.userId}::${item.campaign.campaignId}`;
            if (!reviewedPairs.has(reviewKey)) {
              const categoryCode = item.campaign.category || "default";
              const commentList = commentsMap[categoryCode] || commentsMap["default"];
              const commentObj = commentList[Math.floor(Math.random() * commentList.length)];
              
              await tx.voucherReview.create({
                data: {
                  customerId: customer.userId,
                  campaignId: item.campaign.campaignId,
                  rating: commentObj.rating,
                  comment: commentObj.text,
                  createdAt: new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000), // review sau 4 ngày
                },
              });
              reviewedPairs.add(reviewKey);
            }
          }
        }
      }
    }, { timeout: 30000 });
  }

  console.log(`Đã sinh xong toàn bộ ${TOTAL_ORDERS} đơn hàng và lịch sử giao dịch mẫu!`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    pool.end();
  })
  .catch(async (e) => {
    console.error("Lỗi khi sinh giao dịch mẫu:", e);
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  });

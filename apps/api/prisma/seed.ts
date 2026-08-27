import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Sử dụng một bcrypt hash cố định đại diện cho mật khẩu "Password123"
const DEFAULT_PASSWORD_HASH = "$2b$10$FQgA0cVsWGkuhZAX8nfBte.tjl.wXzY8aO3eO.siP1gybqxO/dfoy";

async function main() {
  console.log("Bắt đầu dọn dẹp cơ sở dữ liệu...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Complaints",
      "Content_Entries",
      "Activity_Logs",
      "Audit_Logs",
      "Voucher_Usage_Log",
      "Voucher_Codes",
      "Payment_Refunds",
      "Payment_Webhook_Events",
      "Payment_Transactions",
      "Inventory_Reservations",
      "Order_Items",
      "Orders",
      "Campaign_Branches",
      "Voucher_Campaigns",
      "Branches",
      "Partners",
      "Users"
    CASCADE;
  `);
  console.log("Đã dọn dẹp xong cơ sở dữ liệu.");

  console.log("Bắt đầu tạo dữ liệu nền (Tài khoản đối tác thật, Chi nhánh thật, Nhân viên)...");

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // 1. Tạo tài khoản Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@vouchersystem.com",
      phone: "0900000000",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Hệ thống Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // Tạo 9 khách hàng mẫu phong phú và thực tế Việt Nam
  const customersInfo = [
    { email: "customer1@gmail.com", fullName: "Nguyễn Văn Khách Hàng 1", phone: "0901234567" },
    { email: "customer2@gmail.com", fullName: "Lê Thị Khách Hàng 2", phone: "0901234568" },
    { email: "customer3@gmail.com", fullName: "Trần Văn Khách Hàng 3", phone: "0901234569" },
    { email: "customer.minhhoang@gmail.com", fullName: "Phạm Minh Hoàng", phone: "0907777111" },
    { email: "customer.thutrang@gmail.com", fullName: "Trần Thu Trang", phone: "0907777222" },
    { email: "customer.minhduc@gmail.com", fullName: "Nguyễn Minh Đức", phone: "0907777333" },
    { email: "customer.thaovy@gmail.com", fullName: "Lê Thảo Vy", phone: "0907777444" },
    { email: "customer.anhtuan@gmail.com", fullName: "Hoàng Anh Tuấn", phone: "0907777555" },
    { email: "customer.hoangyen@gmail.com", fullName: "Vũ Hoàng Yến", phone: "0907777666" },
  ];

  const createdCustomers = [];
  for (const c of customersInfo) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        phone: c.phone,
        passwordHash: DEFAULT_PASSWORD_HASH,
        fullName: c.fullName,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    createdCustomers.push(user);
  }

  // 2. Tạo các tài khoản Owners của các đối tác thương hiệu thật (20 đối tác cực kỳ đầy đủ)
  const partnersInfo = [
    {
      email: "partner.cong@gmail.com",
      phone: "0912111111",
      fullName: "Đại diện Cộng Cà Phê",
      companyName: "Công ty Cổ phần Thương mại và Dịch vụ Cộng Cà Phê",
      taxCode: "0108888888",
      representative: "Nguyễn Hà Ninh",
    },
    {
      email: "partner.highlands@gmail.com",
      phone: "0912222222",
      fullName: "Đại diện Highlands Coffee",
      companyName: "Công ty Cổ phần Dịch vụ Cà phê Cao Nguyên",
      taxCode: "0109999999",
      representative: "David Thái",
    },
    {
      email: "partner.cgv@gmail.com",
      phone: "0912333333",
      fullName: "Đại diện CGV Cinemas",
      companyName: "Công ty TNHH CJ CGV Việt Nam",
      taxCode: "0107777777",
      representative: "Ko Jae Min",
    },
    {
      email: "partner.grab@gmail.com",
      phone: "0912444444",
      fullName: "Đại diện Grab Vietnam",
      companyName: "Công ty TNHH Grab (Vietnam)",
      taxCode: "0106666666",
      representative: "Alejandro Osorio",
    },
    {
      email: "partner.touslesjours@gmail.com",
      phone: "0912555555",
      fullName: "Đại diện TOUS les JOURS",
      companyName: "Công ty TNHH TOUS les JOURS Việt Nam",
      taxCode: "0105555555",
      representative: "Lim Jong Sung",
    },
    {
      email: "partner.pizza4ps@gmail.com",
      phone: "0912666666",
      fullName: "Đại diện Pizza 4P's",
      companyName: "Công ty Cổ phần Pizza 4P's",
      taxCode: "0104444444",
      representative: "Yosuke Masuko",
    },
    {
      email: "partner.lotteria@gmail.com",
      phone: "0912777777",
      fullName: "Đại diện Lotteria",
      companyName: "Công ty TNHH Lotteria Việt Nam",
      taxCode: "0103333333",
      representative: "Choi Kee Ryong",
    },
    {
      email: "partner.dottie@gmail.com",
      phone: "0912888888",
      fullName: "Đại diện Dottie",
      companyName: "Công ty TNHH Thời trang Dottie",
      taxCode: "0102222222",
      representative: "Nguyễn Lê Trung",
    },
    {
      email: "partner.bactom@gmail.com",
      phone: "0912999999",
      fullName: "Đại diện Bác Tôm",
      companyName: "Chuỗi thực phẩm sạch Bác Tôm",
      taxCode: "0101111112",
      representative: "Trần Mạnh Chiến",
    },
    {
      email: "partner.kmarket@gmail.com",
      phone: "0912000000",
      fullName: "Đại diện K-Market",
      companyName: "Công ty TNHH K-Market",
      taxCode: "0101111113",
      representative: "Kang Myeong Man",
    },
    {
      email: "partner.cocospa@gmail.com",
      phone: "0912111112",
      fullName: "Đại diện Coco Spa",
      companyName: "Coco Spa & Clinic Việt Nam",
      taxCode: "0101111114",
      representative: "Lee Min Hee",
    },
    {
      email: "partner.hplus@gmail.com",
      phone: "0912222223",
      fullName: "Đại diện Y Tế H Plus",
      companyName: "Hệ thống Y khoa H Plus Group",
      taxCode: "0101111115",
      representative: "Nguyễn Thanh Hải",
    },
    {
      email: "partner.smilebeauty@gmail.com",
      phone: "0912333334",
      fullName: "Đại diện Smile Beauty",
      companyName: "Nha khoa Thẩm mỹ Smile Beauty",
      taxCode: "0101111116",
      representative: "Lê Thu Trang",
    },
    {
      email: "partner.lottecinema@gmail.com",
      phone: "0912444445",
      fullName: "Đại diện Lotte Cinema",
      companyName: "Công ty TNHH Lotte Cinema Việt Nam",
      taxCode: "0101111117",
      representative: "Lee Hae Sun",
    },
    {
      email: "partner.life4cuts@gmail.com",
      phone: "0912555556",
      fullName: "Đại diện Life4cuts",
      companyName: "Công ty TNHH Life4cuts Việt Nam",
      taxCode: "0101111118",
      representative: "Kim Ji Hoon",
    },
    {
      email: "partner.extrim@gmail.com",
      phone: "0912666667",
      fullName: "Đại diện Extrim",
      companyName: "Công ty TNHH Extrim Việt Nam",
      taxCode: "0101111119",
      representative: "Nguyễn Minh Đăng",
    },
    {
      email: "partner.go2joy@gmail.com",
      phone: "0912777778",
      fullName: "Đại diện Go2Joy",
      companyName: "Công ty Cổ phần Go2Joy Việt Nam",
      taxCode: "0101111120",
      representative: "Simon Byun",
    },
    {
      email: "partner.hoayeuthuong@gmail.com",
      phone: "0912888889",
      fullName: "Đại diện Hoa Yêu Thương",
      companyName: "Công ty Cổ phần Hoa Yêu Thương",
      taxCode: "0101111121",
      representative: "Phạm Hoàng Thái Dương",
    },
    {
      email: "partner.westway@gmail.com",
      phone: "0912999990",
      fullName: "Đại diện Westway Dental",
      companyName: "Viện Nha khoa Quốc tế Westway",
      taxCode: "0101111122",
      representative: "Trần Nguyễn Minh Phú",
    },
    {
      email: "partner.suoitien@gmail.com",
      phone: "0912000001",
      fullName: "Đại diện Công Viên Suối Tiên",
      companyName: "Công ty Cổ phần Du lịch Văn hóa Suối Tiên",
      taxCode: "0101111123",
      representative: "Đinh Văn Vui",
    },
  ];

  const createdPartners: Record<string, string> = {};

  for (const info of partnersInfo) {
    const user = await prisma.user.create({
      data: {
        email: info.email,
        phone: info.phone,
        passwordHash: DEFAULT_PASSWORD_HASH,
        fullName: info.fullName,
        role: "PARTNER",
        status: "ACTIVE",
      },
    });

    const partner = await prisma.partner.create({
      data: {
        partnerId: user.userId,
        companyName: info.companyName,
        taxCode: info.taxCode,
        representative: info.representative,
        approvalStatus: "APPROVED",
        accountStatus: "ACTIVE",
      },
    });

    createdPartners[info.email] = partner.partnerId;
  }

  // 3. Tạo các chi nhánh thật cho từng đối tác (Gán đúng chủ sở hữu 100%)
  const partnerCongId = createdPartners["partner.cong@gmail.com"];
  const partnerHighlandsId = createdPartners["partner.highlands@gmail.com"];
  const partnerCgvId = createdPartners["partner.cgv@gmail.com"];
  const partnerGrabId = createdPartners["partner.grab@gmail.com"];
  const partnerTousLesJoursId = createdPartners["partner.touslesjours@gmail.com"];
  const partnerPizza4PsId = createdPartners["partner.pizza4ps@gmail.com"];
  const partnerLotteriaId = createdPartners["partner.lotteria@gmail.com"];
  const partnerDottieId = createdPartners["partner.dottie@gmail.com"];
  const partnerBacTomId = createdPartners["partner.bactom@gmail.com"];
  const partnerKMarketId = createdPartners["partner.kmarket@gmail.com"];
  const partnerCocoSpaId = createdPartners["partner.cocospa@gmail.com"];
  const partnerHPlusId = createdPartners["partner.hplus@gmail.com"];
  const partnerSmileBeautyId = createdPartners["partner.smilebeauty@gmail.com"];
  const partnerLotteCinemaId = createdPartners["partner.lottecinema@gmail.com"];
  const partnerLife4cutsId = createdPartners["partner.life4cuts@gmail.com"];
  const partnerExtrimId = createdPartners["partner.extrim@gmail.com"];
  const partnerGo2JoyId = createdPartners["partner.go2joy@gmail.com"];
  const partnerHoaYeuThuongId = createdPartners["partner.hoayeuthuong@gmail.com"];
  const partnerWestwayId = createdPartners["partner.westway@gmail.com"];
  const partnerSuoiTienId = createdPartners["partner.suoitien@gmail.com"];

  // Cộng Cà Phê
  const branchCongHN = await prisma.branch.create({
    data: { partnerId: partnerCongId, name: "Cộng Cà Phê - Cầu Gỗ (Hà Nội)", address: "Số 116 Cầu Gỗ, Phường Hàng Đào, Quận Hoàn Kiếm, Hà Nội", provinceCode: "01" }
  });
  const branchCongHCM = await prisma.branch.create({
    data: { partnerId: partnerCongId, name: "Cộng Cà Phê - Sư Vạn Hạnh (TP.HCM)", address: "764 Sư Vạn Hạnh, Phường 12, Quận 10, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Highlands Coffee
  const branchHighlandsHN = await prisma.branch.create({
    data: { partnerId: partnerHighlandsId, name: "Highlands Coffee - Nhà Hát Lớn (Hà Nội)", address: "Số 1 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội", provinceCode: "01" }
  });
  const branchHighlandsHCM = await prisma.branch.create({
    data: { partnerId: partnerHighlandsId, name: "Highlands Coffee - Diamond Plaza (TP.HCM)", address: "Tầng trệt, Diamond Plaza, 34 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // CGV Cinemas
  const branchCgvHN = await prisma.branch.create({
    data: { partnerId: partnerCgvId, name: "CGV Cinemas - Vincom Nguyễn Chí Thanh (Hà Nội)", address: "Tầng 6, Vincom Center Nguyễn Chí Thanh, 54A Nguyễn Chí Thanh, Láng Thượng, Đống Đa, Hà Nội", provinceCode: "01" }
  });
  const branchCgvHCM = await prisma.branch.create({
    data: { partnerId: partnerCgvId, name: "CGV Cinemas - Hùng Vương Plaza (TP.HCM)", address: "Tầng 7, Hùng Vương Plaza, 126 Hùng Vương, Phường 12, Quận 5, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Grab Vietnam
  const branchGrabHN = await prisma.branch.create({
    data: { partnerId: partnerGrabId, name: "Grab Vietnam - Văn phòng Lotte (Hà Nội)", address: "Tầng 30, Tòa nhà Lotte Center Hà Nội, 54 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội", provinceCode: "01" }
  });
  const branchGrabHCM = await prisma.branch.create({
    data: { partnerId: partnerGrabId, name: "Grab Vietnam - Văn phòng Mapletree (TP.HCM)", address: "Tầng 15, Mapletree Business Centre, 1060 Nguyễn Văn Linh, Tân Phong, Quận 7, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // TOUS les JOURS
  const branchTousLesJoursHN = await prisma.branch.create({
    data: { partnerId: partnerTousLesJoursId, name: "Tous les Jours - Keangnam (Hà Nội)", address: "Tầng 1, Keangnam Landmark 72, Phạm Hùng, Mễ Trì, Nam Từ Liêm, Hà Nội", provinceCode: "01" }
  });
  const branchTousLesJoursHCM = await prisma.branch.create({
    data: { partnerId: partnerTousLesJoursId, name: "Tous les Jours - Hai Bà Trưng (TP.HCM)", address: "180 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Pizza 4P's
  const branchPizza4PsHN = await prisma.branch.create({
    data: { partnerId: partnerPizza4PsId, name: "Pizza 4P's - Tràng Tiền (Hà Nội)", address: "43 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội", provinceCode: "01" }
  });
  const branchPizza4PsHCM = await prisma.branch.create({
    data: { partnerId: partnerPizza4PsId, name: "Pizza 4P's - Bến Thành (TP.HCM)", address: "8 Thủ Khoa Huân, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Lotteria
  const branchLotteriaHN = await prisma.branch.create({
    data: { partnerId: partnerLotteriaId, name: "Lotteria - Lotte Center (Hà Nội)", address: "Tầng B1, Lotte Center, 54 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội", provinceCode: "01" }
  });
  const branchLotteriaHCM = await prisma.branch.create({
    data: { partnerId: partnerLotteriaId, name: "Lotteria - Nguyễn Đình Chiểu (TP.HCM)", address: "126 Nguyễn Đình Chiểu, Phường 6, Quận 3, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Dottie
  const branchDottieHN = await prisma.branch.create({
    data: { partnerId: partnerDottieId, name: "Dottie - Chùa Bộc (Hà Nội)", address: "16 Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Hà Nội", provinceCode: "01" }
  });
  const branchDottieHCM = await prisma.branch.create({
    data: { partnerId: partnerDottieId, name: "Dottie - Nguyễn Trãi (TP.HCM)", address: "170 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Bác Tôm
  const branchBacTomHN = await prisma.branch.create({
    data: { partnerId: partnerBacTomId, name: "Bác Tôm - Nguyễn Công Trứ (Hà Nội)", address: "Số 6 Nguyễn Công Trứ, Phường Phạm Đình Hổ, Quận Hai Bà Trưng, Hà Nội", provinceCode: "01" }
  });
  const branchBacTomHCM = await prisma.branch.create({
    data: { partnerId: partnerBacTomId, name: "Bác Tôm - Thảo Điền (TP.HCM)", address: "24 Thảo Điền, Phường Thảo Điền, Quận 2, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // K-Market
  const branchKMarketHN = await prisma.branch.create({
    data: { partnerId: partnerKMarketId, name: "K-Market - Keangnam (Hà Nội)", address: "Tầng trệt, Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội", provinceCode: "01" }
  });
  const branchKMarketHCM = await prisma.branch.create({
    data: { partnerId: partnerKMarketId, name: "K-Market - Thảo Điền (TP.HCM)", address: "26 Thảo Điền, Phường Thảo Điền, Quận 2, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Coco Spa
  const branchCocoSpaHN = await prisma.branch.create({
    data: { partnerId: partnerCocoSpaId, name: "Coco Spa - Hồ Tây (Hà Nội)", address: "145 Vệ Hồ, Phường Xuân La, Quận Tây Hồ, Hà Nội", provinceCode: "01" }
  });
  const branchCocoSpaHCM = await prisma.branch.create({
    data: { partnerId: partnerCocoSpaId, name: "Coco Spa - Quận 1 (TP.HCM)", address: "Số 10 Lý Tự Trọng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Y Tế H Plus
  const branchHPlusHN = await prisma.branch.create({
    data: { partnerId: partnerHPlusId, name: "Y Tế H Plus - Láng Hạ (Hà Nội)", address: "12 Láng Hạ, Phường Thành Công, Quận Ba Đình, Hà Nội", provinceCode: "01" }
  });
  const branchHPlusHCM = await prisma.branch.create({
    data: { partnerId: partnerHPlusId, name: "Y Tế H Plus - Quận 3 (TP.HCM)", address: "154 Võ Thị Sáu, Phường 6, Quận 3, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Smile Beauty
  const branchSmileBeautyHN = await prisma.branch.create({
    data: { partnerId: partnerSmileBeautyId, name: "Smile Beauty - Đống Đa (Hà Nội)", address: "101 Nguyễn Chí Thanh, Phường Láng Hạ, Quận Đống Đa, Hà Nội", provinceCode: "01" }
  });
  const branchSmileBeautyHCM = await prisma.branch.create({
    data: { partnerId: partnerSmileBeautyId, name: "Smile Beauty - Quận 10 (TP.HCM)", address: "405 Cách Mạng Tháng Tám, Phường 13, Quận 10, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Lotte Cinema
  const branchLotteCinemaHN = await prisma.branch.create({
    data: { partnerId: partnerLotteCinemaId, name: "Lotte Cinema - Landmark (Hà Nội)", address: "Tầng 5, Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội", provinceCode: "01" }
  });
  const branchLotteCinemaHCM = await prisma.branch.create({
    data: { partnerId: partnerLotteCinemaId, name: "Lotte Cinema - Nam Sài Gòn (TP.HCM)", address: "Tầng 3, Lotte Mart Nam Sài Gòn, 469 Nguyễn Hữu Thọ, Tân Hưng, Quận 7, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Life4cuts
  const branchLife4cutsHN = await prisma.branch.create({
    data: { partnerId: partnerLife4cutsId, name: "Life4cuts - Hoàn Kiếm (Hà Nội)", address: "Số 2 Hàng Khay, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội", provinceCode: "01" }
  });
  const branchLife4cutsHCM = await prisma.branch.create({
    data: { partnerId: partnerLife4cutsId, name: "Life4cuts - Quận 1 (TP.HCM)", address: "Số 120 Nguyễn Huệ, Bến Nghé, Quận 1, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Extrim
  const branchExtrimHN = await prisma.branch.create({
    data: { partnerId: partnerExtrimId, name: "Extrim - Đống Đa (Hà Nội)", address: "45 Nguyễn Chí Thanh, Phường Láng Hạ, Quận Đống Đa, Hà Nội", provinceCode: "01" }
  });
  const branchExtrimHCM = await prisma.branch.create({
    data: { partnerId: partnerExtrimId, name: "Extrim - Quận 3 (TP.HCM)", address: "127 Lý Chính Thắng, Phường 7, Quận 3, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Go2Joy
  const branchGo2JoyHN = await prisma.branch.create({
    data: { partnerId: partnerGo2JoyId, name: "Văn phòng Go2Joy (Hà Nội)", address: "Tầng 10, Tòa nhà HL, ngõ 82 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội", provinceCode: "01" }
  });
  const branchGo2JoyHCM = await prisma.branch.create({
    data: { partnerId: partnerGo2JoyId, name: "Văn phòng Go2Joy (TP.HCM)", address: "Tầng 12, Tòa nhà M-H, 728-730 Võ Văn Kiệt, Phường 1, Quận 5, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Hoa Yêu Thương
  const branchHoaYeuThuongHN = await prisma.branch.create({
    data: { partnerId: partnerHoaYeuThuongId, name: "Hoa Yêu Thương - Hai Bà Trưng (Hà Nội)", address: "354 Lạc Trung, Phường Thanh Lương, Quận Hai Bà Trưng, Hà Nội", provinceCode: "01" }
  });
  const branchHoaYeuThuongHCM = await prisma.branch.create({
    data: { partnerId: partnerHoaYeuThuongId, name: "Hoa Yêu Thương - Quận 3 (TP.HCM)", address: "270L Võ Thị Sáu, Phường 7, Quận 3, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Westway Dental
  const branchWestwayHN = await prisma.branch.create({
    data: { partnerId: partnerWestwayId, name: "Westway Dental - Cầu Giấy (Hà Nội)", address: "Tầng 2, Vincom Plaza Trần Duy Hưng, Cầu Giấy, Hà Nội", provinceCode: "01" }
  });
  const branchWestwayHCM = await prisma.branch.create({
    data: { partnerId: partnerWestwayId, name: "Westway Dental - Thảo Điền (TP.HCM)", address: "122 Xuân Thủy, Phường Thảo Điền, Quận 2, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // Suối Tiên
  const branchSuoiTienHCM = await prisma.branch.create({
    data: { partnerId: partnerSuoiTienId, name: "Công Viên Văn Hóa Suối Tiên (TP.HCM)", address: "120 Xa lộ Hà Nội, Phường Tân Phú, Quận 9, TP. Hồ Chí Minh", provinceCode: "79" }
  });

  // 4. TỰ ĐỘNG TẠO 1 TÀI KHOẢN NHÂN VIÊN CHO MỌI CHI NHÁNH TRONG HỆ THỐNG
  const allBranches = [
    { branch: branchCongHN, prefix: "cong.hn", partnerId: partnerCongId, name: "Cộng Cầu Gỗ" },
    { branch: branchCongHCM, prefix: "cong.hcm", partnerId: partnerCongId, name: "Cộng Sư Vạn Hạnh" },
    { branch: branchHighlandsHN, prefix: "highlands.hn", partnerId: partnerHighlandsId, name: "Highlands Nhà Hát Lớn" },
    { branch: branchHighlandsHCM, prefix: "highlands.hcm", partnerId: partnerHighlandsId, name: "Highlands Diamond" },
    { branch: branchCgvHN, prefix: "cgv.hn", partnerId: partnerCgvId, name: "CGV Nguyễn Chí Thanh" },
    { branch: branchCgvHCM, prefix: "cgv.hcm", partnerId: partnerCgvId, name: "CGV Hùng Vương" },
    { branch: branchGrabHN, prefix: "grab.hn", partnerId: partnerGrabId, name: "Grab Lotte HN" },
    { branch: branchGrabHCM, prefix: "grab.hcm", partnerId: partnerGrabId, name: "Grab Mapletree HCM" },
    { branch: branchTousLesJoursHN, prefix: "touslesjours.hn", partnerId: partnerTousLesJoursId, name: "Tous les Jours Keangnam" },
    { branch: branchTousLesJoursHCM, prefix: "touslesjours.hcm", partnerId: partnerTousLesJoursId, name: "Tous les Jours Hai Bà Trưng" },
    { branch: branchPizza4PsHN, prefix: "pizza4ps.hn", partnerId: partnerPizza4PsId, name: "Pizza 4P's Tràng Tiền" },
    { branch: branchPizza4PsHCM, prefix: "pizza4ps.hcm", partnerId: partnerPizza4PsId, name: "Pizza 4P's Bến Thành" },
    { branch: branchLotteriaHN, prefix: "lotteria.hn", partnerId: partnerLotteriaId, name: "Lotteria Lotte Center" },
    { branch: branchLotteriaHCM, prefix: "lotteria.hcm", partnerId: partnerLotteriaId, name: "Lotteria Nguyễn Đình Chiểu" },
    { branch: branchDottieHN, prefix: "dottie.hn", partnerId: partnerDottieId, name: "Dottie Chùa Bộc" },
    { branch: branchDottieHCM, prefix: "dottie.hcm", partnerId: partnerDottieId, name: "Dottie Nguyễn Trãi" },
    { branch: branchBacTomHN, prefix: "bactom.hn", partnerId: partnerBacTomId, name: "Bác Tôm Nguyễn Công Trứ" },
    { branch: branchBacTomHCM, prefix: "bactom.hcm", partnerId: partnerBacTomId, name: "Bác Tôm Thảo Điền" },
    { branch: branchKMarketHN, prefix: "kmarket.hn", partnerId: partnerKMarketId, name: "K-Market Keangnam" },
    { branch: branchKMarketHCM, prefix: "kmarket.hcm", partnerId: partnerKMarketId, name: "K-Market Thảo Điền" },
    { branch: branchCocoSpaHN, prefix: "cocospa.hn", partnerId: partnerCocoSpaId, name: "Coco Spa Hồ Tây" },
    { branch: branchCocoSpaHCM, prefix: "cocospa.hcm", partnerId: partnerCocoSpaId, name: "Coco Spa Quận 1" },
    { branch: branchHPlusHN, prefix: "hplus.hn", partnerId: partnerHPlusId, name: "Y Tế H Plus Láng Hạ" },
    { branch: branchHPlusHCM, prefix: "hplus.hcm", partnerId: partnerHPlusId, name: "Y Tế H Plus Quận 3" },
    { branch: branchSmileBeautyHN, prefix: "smilebeauty.hn", partnerId: partnerSmileBeautyId, name: "Smile Beauty Đống Đa" },
    { branch: branchSmileBeautyHCM, prefix: "smilebeauty.hcm", partnerId: partnerSmileBeautyId, name: "Smile Beauty Quận 10" },
    { branch: branchLotteCinemaHN, prefix: "lottecinema.hn", partnerId: partnerLotteCinemaId, name: "Lotte Cinema Landmark" },
    { branch: branchLotteCinemaHCM, prefix: "lottecinema.hcm", partnerId: partnerLotteCinemaId, name: "Lotte Cinema Nam Sài Gòn" },
    { branch: branchLife4cutsHN, prefix: "life4cuts.hn", partnerId: partnerLife4cutsId, name: "Life4cuts Hoàn Kiếm" },
    { branch: branchLife4cutsHCM, prefix: "life4cuts.hcm", partnerId: partnerLife4cutsId, name: "Life4cuts Quận 1" },
    { branch: branchExtrimHN, prefix: "extrim.hn", partnerId: partnerExtrimId, name: "Extrim Đống Đa" },
    { branch: branchExtrimHCM, prefix: "extrim.hcm", partnerId: partnerExtrimId, name: "Extrim Quận 3" },
    { branch: branchGo2JoyHN, prefix: "go2joy.hn", partnerId: partnerGo2JoyId, name: "Go2Joy Cầu Giấy" },
    { branch: branchGo2JoyHCM, prefix: "go2joy.hcm", partnerId: partnerGo2JoyId, name: "Go2Joy Quận 5" },
    { branch: branchHoaYeuThuongHN, prefix: "hoayeuthuong.hn", partnerId: partnerHoaYeuThuongId, name: "Hoa Yêu Thương Lạc Trung" },
    { branch: branchHoaYeuThuongHCM, prefix: "hoayeuthuong.hcm", partnerId: partnerHoaYeuThuongId, name: "Hoa Yêu Thương Quận 3" },
    { branch: branchWestwayHN, prefix: "westway.hn", partnerId: partnerWestwayId, name: "Westway Trần Duy Hưng" },
    { branch: branchWestwayHCM, prefix: "westway.hcm", partnerId: partnerWestwayId, name: "Westway Thảo Điền" },
    { branch: branchSuoiTienHCM, prefix: "suoitien.hcm", partnerId: partnerSuoiTienId, name: "Suối Tiên Quận 9" },
  ];

  console.log(`Đang tự động sinh ${allBranches.length} tài khoản nhân viên chi nhánh...`);
  for (const item of allBranches) {
    await prisma.user.create({
      data: {
        email: `staff.${item.prefix}@gmail.com`,
        phone: "092" + Math.floor(Math.random() * 10000000).toString().padStart(7, "0"),
        passwordHash: DEFAULT_PASSWORD_HASH,
        fullName: `Nhân viên ${item.name}`,
        role: "PARTNER_STAFF",
        partnerId: item.partnerId,
        branchId: item.branch.branchId,
        status: "ACTIVE",
      },
    });
  }

  // 5. Tạo một số Audit Logs làm mẫu
  await prisma.auditLog.create({
    data: {
      adminId: admin.userId,
      adminNameSnapshot: admin.fullName || "Admin",
      adminEmailSnapshot: admin.email,
      actionType: "APPROVE_PARTNER",
      targetEntity: "Partners",
      targetId: partnerCongId,
      timestamp: oneMonthAgo,
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        actorUserId: admin.userId,
        actorRoleSnapshot: "ADMIN",
        category: "ADMIN",
        actionType: "APPROVE_PARTNER",
        targetEntity: "Partners",
        targetId: partnerCongId,
        metadata: { source: "seed" },
        occurredAt: oneMonthAgo,
      },
      {
        actorUserId: createdCustomers[0].userId,
        actorRoleSnapshot: "CUSTOMER",
        category: "AUTH",
        actionType: "USER_LOGIN",
        targetEntity: "Users",
        targetId: createdCustomers[0].userId,
        metadata: { client: "web" },
        occurredAt: oneWeekAgo,
      },
    ],
  });

  await prisma.contentEntry.createMany({
    data: [
      {
        type: "BANNER",
        slug: "home-summer-vouchers",
        title: "Ưu đãi voucher nổi bật",
        summary: "Khám phá các voucher đang mở bán trên hệ thống.",
        linkUrl: "/",
        status: "PUBLISHED",
        displayOrder: 1,
        publishedAt: oneMonthAgo,
        createdById: admin.userId,
        updatedById: admin.userId,
      },
      {
        type: "POLICY",
        slug: "refund-policy",
        title: "Chính sách hủy và hoàn tiền",
        body: "Điều kiện hoàn tiền cụ thể được hiển thị và lưu tại thời điểm đặt mua voucher.",
        status: "PUBLISHED",
        displayOrder: 1,
        publishedAt: oneMonthAgo,
        createdById: admin.userId,
        updatedById: admin.userId,
      },
    ],
  });

  console.log("Đã nạp dữ liệu nền và tài khoản gốc thành công!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    pool.end();
  })
  .catch(async (e) => {
    console.error("Lỗi khi seed dữ liệu nền:", e);
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  });

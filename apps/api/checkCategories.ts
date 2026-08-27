import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.voucherCampaign.findMany({
    select: { category: true },
    distinct: ['category'],
  });
  console.log('Categories:', categories);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { Prisma } from '@prisma/client';

type PriceValue = Prisma.Decimal | number | string;

export function resolveSellingPrice(
  originalPrice: PriceValue,
  salePrice: PriceValue | null | undefined,
): Prisma.Decimal {
  return new Prisma.Decimal(salePrice ?? originalPrice);
}

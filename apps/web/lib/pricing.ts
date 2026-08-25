export type PriceValue = number | string;

export interface CampaignPrice {
  originalPrice: PriceValue;
  salePrice?: PriceValue | null;
  sellingPrice?: PriceValue | null;
}

export function resolveSellingPrice(campaign: CampaignPrice): number {
  return Number(
    campaign.sellingPrice ?? campaign.salePrice ?? campaign.originalPrice,
  );
}

export function hasDiscount(campaign: CampaignPrice): boolean {
  return (
    campaign.salePrice != null &&
    Number(campaign.salePrice) < Number(campaign.originalPrice)
  );
}

export function discountPercentage(campaign: CampaignPrice): number {
  if (!hasDiscount(campaign)) return 0;
  return Math.round(
    ((Number(campaign.originalPrice) - Number(campaign.salePrice)) /
      Number(campaign.originalPrice)) *
      100,
  );
}

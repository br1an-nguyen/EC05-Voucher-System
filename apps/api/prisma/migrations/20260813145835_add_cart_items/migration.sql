-- CreateTable
CREATE TABLE "Cart_Items" (
    "cart_item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Cart_Items_pkey" PRIMARY KEY ("cart_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_Items_customer_id_campaign_id_key" ON "Cart_Items"("customer_id", "campaign_id");

-- AddForeignKey
ALTER TABLE "Cart_Items" ADD CONSTRAINT "Cart_Items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart_Items" ADD CONSTRAINT "Cart_Items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

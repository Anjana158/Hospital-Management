CREATE TYPE "BillingAdjustmentType" AS ENUM ('MISCELLANEOUS');

ALTER TABLE "Bill"
    DROP CONSTRAINT "Bill_amounts_check",
    ADD COLUMN "miscellaneousAmount" DECIMAL(10,2),
    ADD COLUMN "miscellaneousDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "adjustmentType" "BillingAdjustmentType";

ALTER TABLE "Bill"
    ADD CONSTRAINT "Bill_amounts_check" CHECK (
        "grossAmount" >= 0 AND
        "discountAmount" >= 0 AND
        "discountAmount" <= "grossAmount" AND
        "miscellaneousDiscountAmount" >= 0 AND
        "miscellaneousDiscountAmount" <= "grossAmount" - "discountAmount" AND
        "netPayable" = "grossAmount" - "discountAmount" - "miscellaneousDiscountAmount" AND
        (
            ("adjustmentType" IS NULL AND "miscellaneousAmount" IS NULL AND "miscellaneousDiscountAmount" = 0) OR
            (
                "adjustmentType" = 'MISCELLANEOUS' AND
                "miscellaneousAmount" IS NOT NULL AND
                "miscellaneousAmount" >= 0 AND
                "miscellaneousAmount" <= "grossAmount" - "discountAmount" AND
                "miscellaneousAmount" = "netPayable" AND
                "miscellaneousDiscountAmount" = "grossAmount" - "discountAmount" - "miscellaneousAmount"
            )
        )
    );

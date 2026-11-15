CREATE TYPE "BillingCategory" AS ENUM ('APL', 'BPL');
CREATE TYPE "BillingStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'WAIVED');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('CONFIRMED', 'REVERSED');

CREATE TABLE "BillingService" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingService_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingService_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillingService_name_key" ON "BillingService"("name");
CREATE INDEX "BillingService_isActive_name_idx" ON "BillingService"("isActive", "name");

CREATE TABLE "ServiceTariff" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "category" "BillingCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    CONSTRAINT "ServiceTariff_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceTariff_amount_check" CHECK ("amount" >= 0 AND ("amount" > 0 OR "isFree") AND ("amount" = 0 OR NOT "isFree")),
    CONSTRAINT "ServiceTariff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceTariff_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ServiceTariff_serviceId_category_endedAt_idx" ON "ServiceTariff"("serviceId", "category", "endedAt");
CREATE UNIQUE INDEX "ServiceTariff_one_current_per_category" ON "ServiceTariff"("serviceId", "category") WHERE "endedAt" IS NULL;

CREATE TABLE "BillingSchemeBenefit" (
    "id" SERIAL NOT NULL,
    "schemeId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "discountType" "SchemeDiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isWaived" BOOLEAN NOT NULL DEFAULT false,
    "specialAplTariff" DECIMAL(10,2),
    "specialBplTariff" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingSchemeBenefit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingSchemeBenefit_config_check" CHECK (
        "discountValue" >= 0 AND
        (("discountType" = 'NONE' AND "discountValue" = 0) OR
         ("discountType" <> 'NONE' AND "discountValue" > 0)) AND
        ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100) AND
        (NOT "isWaived" OR ("discountType" = 'NONE' AND "specialAplTariff" IS NULL AND "specialBplTariff" IS NULL)) AND
        (("specialAplTariff" IS NULL AND "specialBplTariff" IS NULL) OR
         ("specialAplTariff" >= 0 AND "specialBplTariff" >= 0 AND "discountType" = 'NONE' AND NOT "isWaived"))
    ),
    CONSTRAINT "BillingSchemeBenefit_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "PatientScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillingSchemeBenefit_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillingSchemeBenefit_schemeId_serviceId_key" ON "BillingSchemeBenefit"("schemeId", "serviceId");
CREATE INDEX "BillingSchemeBenefit_serviceId_idx" ON "BillingSchemeBenefit"("serviceId");

CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "billNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "patientId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "schemeId" INTEGER,
    "category" "BillingCategory" NOT NULL DEFAULT 'APL',
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "netPayable" DECIMAL(10,2) NOT NULL,
    "schemeSnapshot" JSONB,
    "status" "BillingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Bill_amounts_check" CHECK ("grossAmount" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "grossAmount" AND "netPayable" = "grossAmount" - "discountAmount"),
    CONSTRAINT "Bill_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "PatientScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE UNIQUE INDEX "Bill_idempotencyKey_key" ON "Bill"("idempotencyKey");
CREATE INDEX "Bill_createdAt_idx" ON "Bill"("createdAt");
CREATE INDEX "Bill_createdBy_createdAt_idx" ON "Bill"("createdBy", "createdAt");
CREATE INDEX "Bill_patientId_createdAt_idx" ON "Bill"("patientId", "createdAt");
CREATE INDEX "Bill_schemeId_createdAt_idx" ON "Bill"("schemeId", "createdAt");

CREATE TABLE "BillItem" (
    "id" SERIAL NOT NULL,
    "billId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "tariffId" INTEGER NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tariffUnitPrice" DECIMAL(10,2) NOT NULL,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "discountSnapshot" JSONB NOT NULL,
    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillItem_amounts_check" CHECK ("quantity" > 0 AND "tariffUnitPrice" >= 0 AND "grossAmount" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "grossAmount" AND "netAmount" = "grossAmount" - "discountAmount"),
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillItem_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "ServiceTariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");
CREATE INDEX "BillItem_serviceId_billId_idx" ON "BillItem"("serviceId", "billId");

CREATE TABLE "BillPayment" (
    "id" SERIAL NOT NULL,
    "billId" INTEGER NOT NULL,
    "handledBy" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "idempotencyKey" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" INTEGER,
    "reversalReason" TEXT,
    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillPayment_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "BillPayment_reversal_check" CHECK (("status" = 'CONFIRMED' AND "reversedAt" IS NULL AND "reversedBy" IS NULL AND "reversalReason" IS NULL) OR ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND length(trim("reversalReason")) > 0)),
    CONSTRAINT "BillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillPayment_handledBy_fkey" FOREIGN KEY ("handledBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillPayment_reversedBy_fkey" FOREIGN KEY ("reversedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillPayment_idempotencyKey_key" ON "BillPayment"("idempotencyKey");
CREATE INDEX "BillPayment_confirmedAt_method_status_idx" ON "BillPayment"("confirmedAt", "method", "status");
CREATE INDEX "BillPayment_handledBy_confirmedAt_idx" ON "BillPayment"("handledBy", "confirmedAt");
CREATE INDEX "BillPayment_billId_status_idx" ON "BillPayment"("billId", "status");
CREATE INDEX "BillPayment_reversedAt_idx" ON "BillPayment"("reversedAt");

CREATE TABLE "BillingAudit" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingAudit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BillingAudit_entityType_entityId_createdAt_idx" ON "BillingAudit"("entityType", "entityId", "createdAt");
CREATE INDEX "BillingAudit_actorId_createdAt_idx" ON "BillingAudit"("actorId", "createdAt");

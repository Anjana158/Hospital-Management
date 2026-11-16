-- AlterTable
ALTER TABLE "PatientVisit" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "finalFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "opFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyTokenCounter" (
    "id" SERIAL NOT NULL,
    "tokenDate" TIMESTAMP(3) NOT NULL,
    "nextToken" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTokenCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTokenCounter_tokenDate_key" ON "DailyTokenCounter"("tokenDate");

-- CreateIndex
CREATE INDEX "DailyTokenCounter_tokenDate_idx" ON "DailyTokenCounter"("tokenDate");

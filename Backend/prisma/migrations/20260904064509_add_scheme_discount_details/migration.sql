/*
  Warnings:

  - You are about to drop the column `discountEligible` on the `PatientScheme` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SchemeDiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "PatientScheme" DROP COLUMN "discountEligible",
ADD COLUMN     "discountType" "SchemeDiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;

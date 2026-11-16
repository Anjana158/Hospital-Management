-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'FREE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GPAY');

-- AlterTable
ALTER TABLE "PatientVisit" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID';

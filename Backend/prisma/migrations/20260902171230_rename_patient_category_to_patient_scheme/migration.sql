/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the `PatientCategory` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `schemeId` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_categoryId_fkey";

-- DropIndex
DROP INDEX "Patient_categoryId_idx";

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "categoryId",
ADD COLUMN     "schemeId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "PatientCategory";

-- CreateTable
CREATE TABLE "PatientScheme" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientScheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientScheme_code_key" ON "PatientScheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PatientScheme_name_key" ON "PatientScheme"("name");

-- CreateIndex
CREATE INDEX "Patient_schemeId_idx" ON "Patient"("schemeId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "PatientScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

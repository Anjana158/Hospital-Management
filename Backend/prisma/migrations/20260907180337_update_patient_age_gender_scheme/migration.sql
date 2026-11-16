/*
  Warnings:

  - The values [OTHER,UNKNOWN] on the enum `Gender` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `age` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Gender_new" AS ENUM ('MALE', 'FEMALE', 'TRANSGENDER');
ALTER TABLE "public"."Patient" ALTER COLUMN "gender" DROP DEFAULT;
ALTER TABLE "Patient" ALTER COLUMN "gender" TYPE "Gender_new" USING ("gender"::text::"Gender_new");
ALTER TABLE "PatientVisit" ALTER COLUMN "genderAtVisit" TYPE "Gender_new" USING ("genderAtVisit"::text::"Gender_new");
ALTER TYPE "Gender" RENAME TO "Gender_old";
ALTER TYPE "Gender_new" RENAME TO "Gender";
DROP TYPE "public"."Gender_old";
COMMIT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "age" INTEGER NOT NULL,
ALTER COLUMN "gender" DROP DEFAULT,
ALTER COLUMN "schemeId" DROP NOT NULL;

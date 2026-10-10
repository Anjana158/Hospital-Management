-- DropForeignKey
ALTER TABLE "PatientVisit" DROP CONSTRAINT "PatientVisit_doctorId_fkey";

-- DropIndex
DROP INDEX "PatientVisit_doctorId_visitDate_idx";

-- DropIndex
DROP INDEX "PatientVisit_patientId_doctorId_visitDate_idx";

-- DropIndex
DROP INDEX "PatientVisit_patientId_doctorId_revisitCount_idx";

-- AlterTable
ALTER TABLE "PatientVisit" DROP COLUMN "doctorId";

-- DropTable
DROP TABLE "Doctor";

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_departmentId_visitDate_idx" ON "PatientVisit"("patientId", "departmentId", "visitDate");

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_departmentId_revisitCount_idx" ON "PatientVisit"("patientId", "departmentId", "revisitCount");

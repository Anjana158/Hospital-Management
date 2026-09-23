-- AlterTable
ALTER TABLE "PatientVisit" ADD COLUMN     "revisitCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "opFee" SET DEFAULT 10;

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_doctorId_visitDate_idx" ON "PatientVisit"("patientId", "doctorId", "visitDate");

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_doctorId_revisitCount_idx" ON "PatientVisit"("patientId", "doctorId", "revisitCount");

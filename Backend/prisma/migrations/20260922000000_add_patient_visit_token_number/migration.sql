-- Add tokenNumber to PatientVisit without assigning legacy historical values.
ALTER TABLE "PatientVisit"
ADD COLUMN "tokenNumber" INTEGER;

-- Index for daily OP queue ordering by visit date and token number.
CREATE INDEX "PatientVisit_visitDate_tokenNumber_idx"
ON "PatientVisit"("visitDate", "tokenNumber");

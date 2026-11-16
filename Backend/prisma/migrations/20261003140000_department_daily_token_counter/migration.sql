-- Replace the hospital-wide daily counter with one counter per department per day.
-- Existing counter rows cannot be mapped to a department, so they are removed.
-- Issued visit token numbers are kept.

DELETE FROM "DailyTokenCounter";

DROP INDEX IF EXISTS "DailyTokenCounter_tokenDate_key";
DROP INDEX IF EXISTS "DailyTokenCounter_tokenDate_idx";

ALTER TABLE "DailyTokenCounter"
ALTER COLUMN "tokenDate" TYPE DATE USING ("tokenDate"::date);

ALTER TABLE "DailyTokenCounter" ADD COLUMN "departmentId" INTEGER NOT NULL;

ALTER TABLE "DailyTokenCounter"
ADD CONSTRAINT "DailyTokenCounter_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DailyTokenCounter_departmentId_tokenDate_key"
ON "DailyTokenCounter"("departmentId", "tokenDate");

CREATE INDEX "DailyTokenCounter_departmentId_idx"
ON "DailyTokenCounter"("departmentId");

ALTER TABLE "PatientVisit"
ADD COLUMN "tokenPrefix" TEXT NOT NULL DEFAULT 'HMS',
ADD COLUMN "tokenLabel" TEXT,
ADD COLUMN "tokenDate" DATE;

-- Store the permanent HMS label and the local hospital day used by the counter.
UPDATE "PatientVisit"
SET
    "tokenPrefix" = 'HMS',
    "tokenLabel" = 'HMS ' || "tokenNumber"::text,
    "tokenDate" = (("visitDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date
WHERE "tokenNumber" IS NOT NULL;

-- Continue past numbers already issued for that department and day.
INSERT INTO "DailyTokenCounter" (
    "departmentId",
    "tokenDate",
    "nextToken",
    "createdAt",
    "updatedAt"
)
SELECT
    "departmentId",
    "tokenDate",
    MAX("tokenNumber") + 1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "PatientVisit"
WHERE "tokenNumber" IS NOT NULL
  AND "tokenDate" IS NOT NULL
GROUP BY "departmentId", "tokenDate";

CREATE UNIQUE INDEX "PatientVisit_departmentId_tokenDate_tokenNumber_key"
ON "PatientVisit"("departmentId", "tokenDate", "tokenNumber");

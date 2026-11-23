UPDATE "Patient"
SET "firstName" = trim(concat_ws(
    ' ',
    NULLIF(trim("firstName"), ''),
    NULLIF(trim("middleName"), ''),
    NULLIF(trim("lastName"), '')
));

UPDATE "Patient"
SET "addressLine1" = NULLIF(concat_ws(
    ', ',
    NULLIF(trim("addressLine1"), ''),
    NULLIF(trim("addressLine2"), '')
), '');

DROP INDEX IF EXISTS "Patient_lastName_firstName_idx";

ALTER TABLE "Patient"
    DROP COLUMN "middleName",
    DROP COLUMN "lastName",
    DROP COLUMN "addressLine2";

ALTER TYPE "PaymentMethod" ADD VALUE 'POS';

ALTER TABLE "PatientVisit"
    ADD COLUMN "paymentAuthCode" TEXT;

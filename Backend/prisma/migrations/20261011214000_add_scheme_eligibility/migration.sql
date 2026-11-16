-- Add scheme eligibility and optional-information configuration.
ALTER TABLE "PatientScheme"
    ADD COLUMN "eligibilityGender" TEXT NOT NULL DEFAULT 'ALL',
    ADD COLUMN "ageCriteriaType" TEXT NOT NULL DEFAULT 'ALL',
    ADD COLUMN "ageLimit" INTEGER,
    ADD COLUMN "minimumAge" INTEGER,
    ADD COLUMN "maximumAge" INTEGER,
    ADD COLUMN "collectAdditionalInformation" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "additionalInformationFields" JSONB NOT NULL DEFAULT '[]';

-- Keep entered optional values with the current patient scheme application.
ALTER TABLE "Patient"
    ADD COLUMN "schemeAdditionalInformation" JSONB NOT NULL DEFAULT '[]';

-- Preserve the applied scheme rules and entered values independently of later edits.
ALTER TABLE "PatientVisit"
    ADD COLUMN "schemeIdAtVisit" INTEGER,
    ADD COLUMN "schemeCodeAtVisit" TEXT,
    ADD COLUMN "schemeNameAtVisit" TEXT,
    ADD COLUMN "schemeDiscountTypeAtVisit" "SchemeDiscountType",
    ADD COLUMN "schemeDiscountValueAtVisit" DECIMAL(10,2),
    ADD COLUMN "schemeEligibilityAtVisit" JSONB,
    ADD COLUMN "schemeAdditionalInformation" JSONB;

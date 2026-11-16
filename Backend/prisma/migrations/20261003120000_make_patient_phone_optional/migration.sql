-- Phone is optional. Empty registrations are stored as NULL so duplicate checks ignore them.
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL;

-- Read-only correctness checks for the load-test database.
-- This file does not DELETE, UPDATE, DROP, or TRUNCATE.
-- It aborts unless the connected database is exactly hospital_management_loadtest.
-- The API server timezone for this project is Asia/Kolkata.

\set ON_ERROR_STOP on

DO $$
BEGIN
    IF current_database() IS DISTINCT FROM 'hospital_management_loadtest' THEN
        RAISE EXCEPTION 'Refusing verification of database %', current_database();
    END IF;
END $$;

SET TIME ZONE 'Asia/Kolkata';

DO $$
DECLARE
    duplicate_visits integer;
    duplicate_tokens integer;
    duplicate_bills integer;
    payment_mismatches integer;
    negative_balances integer;
    foreign_patients integer;
BEGIN
    IF current_database() IS DISTINCT FROM 'hospital_management_loadtest' THEN
        RAISE EXCEPTION 'Refusing verification of database %', current_database();
    END IF;

    SELECT count(*) INTO duplicate_visits
    FROM (
        SELECT 1
        FROM "PatientVisit"
        WHERE status <> 'CANCELLED'
        GROUP BY "patientId", "departmentId",
                 ((("visitDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date)
        HAVING count(*) > 1
    ) violations;

    SELECT count(*) INTO duplicate_tokens
    FROM (
        SELECT 1
        FROM "PatientVisit"
        WHERE "tokenNumber" IS NOT NULL AND "tokenDate" IS NOT NULL
        GROUP BY "departmentId", "tokenDate", "tokenNumber"
        HAVING count(*) > 1
    ) violations;

    SELECT count(*) INTO duplicate_bills
    FROM (
        SELECT 1
        FROM "Bill"
        WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "idempotencyKey"
        HAVING count(*) > 1
    ) violations;

    SELECT count(*) INTO payment_mismatches
    FROM "Bill" AS bill
    JOIN "BillPayment" AS payment ON payment."billId" = bill.id
    WHERE payment.status = 'CONFIRMED'
      AND payment."idempotencyKey" = bill."idempotencyKey" || ':payment'
      AND payment.amount <> bill."netPayable";

    SELECT count(*) INTO negative_balances
    FROM (
        SELECT bill.id
        FROM "Bill" AS bill
        LEFT JOIN "BillPayment" AS payment
          ON payment."billId" = bill.id AND payment.status = 'CONFIRMED'
        GROUP BY bill.id, bill."netPayable"
        HAVING COALESCE(sum(payment.amount), 0) > bill."netPayable"
    ) violations;

    SELECT count(*) INTO foreign_patients
    FROM "Patient" AS patient
    JOIN users AS creator ON creator.id = patient."createdBy"
    WHERE creator.username NOT LIKE 'loadtest-%';

    IF duplicate_visits > 0 THEN
        RAISE EXCEPTION 'duplicate active same-day visits: %', duplicate_visits;
    END IF;
    IF duplicate_tokens > 0 THEN
        RAISE EXCEPTION 'duplicate token numbers: %', duplicate_tokens;
    END IF;
    IF duplicate_bills > 0 THEN
        RAISE EXCEPTION 'duplicate bill idempotency keys: %', duplicate_bills;
    END IF;
    IF payment_mismatches > 0 THEN
        RAISE EXCEPTION 'confirmed payments that do not match net payable: %', payment_mismatches;
    END IF;
    IF negative_balances > 0 THEN
        RAISE EXCEPTION 'bills whose confirmed payments exceed net payable: %', negative_balances;
    END IF;
    IF foreign_patients > 0 THEN
        RAISE EXCEPTION 'patients not created by a loadtest user: %', foreign_patients;
    END IF;

    RAISE NOTICE 'verification passed on %', current_database();
END $$;

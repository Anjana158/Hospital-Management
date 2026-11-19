import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_DATABASE, testDatabaseUrl } from "../lib/config.js";

const require = createRequire(import.meta.url);
const { Client } = require("../../Backend/node_modules/pg");
const { PrismaClient } = require("../../Backend/node_modules/@prisma/client");
const bcrypt = require("../../Backend/node_modules/bcrypt");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "../Backend");
const usersPath = resolve(root, "data/users.json");
const BULK_PATIENTS = 50000;
const BULK_VISITS = 200000;
const BULK_BILLS = 100000;

function refuse(action, databaseName) {
    if (databaseName !== ALLOWED_DATABASE) {
        throw new Error(`Refusing to ${action} on database "${databaseName}".`);
    }
}

async function assertLive(prisma, action) {
    const rows = await prisma.$queryRaw`
        SELECT current_database() AS name,
               COALESCE(inet_server_addr()::text, 'loopback-socket') AS addr
    `;
    const name = rows[0].name;
    const addr = rows[0].addr;
    refuse(action, name);
    if (addr !== "127.0.0.1" && addr !== "loopback-socket" && !addr.startsWith("127.")) {
        throw new Error(`Refusing ${action}: PostgreSQL peer address is ${addr}, not loopback.`);
    }
}

async function ensureDatabase(target) {
    refuse("create a database", target.database);
    const admin = new Client({
        host: target.host,
        port: Number(target.port),
        user: target.user,
        password: target.password,
        database: "postgres",
    });
    await admin.connect();
    try {
        const probe = await admin.query("SELECT current_database() AS name, inet_server_addr()::text AS addr");
        if (probe.rows[0].name !== "postgres") {
            throw new Error("Admin connection did not land on the postgres maintenance database.");
        }
        const addr = probe.rows[0].addr;
        if (addr && addr !== "127.0.0.1" && !String(addr).startsWith("127.")) {
            throw new Error(`Refusing to create a database through peer ${addr}.`);
        }
        const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [ALLOWED_DATABASE]);
        if (existing.rowCount === 0) {
            refuse("CREATE DATABASE", ALLOWED_DATABASE);
            await admin.query(`CREATE DATABASE "${ALLOWED_DATABASE}"`);
            console.log(`Created database ${ALLOWED_DATABASE}.`);
        } else {
            console.log(`Database ${ALLOWED_DATABASE} already exists. It was not dropped.`);
        }
    } finally {
        await admin.end();
    }
}

function migrate(target) {
    refuse("apply migrations", target.database);
    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
        cwd: backend,
        env: { ...process.env, DATABASE_URL: target.url },
        stdio: "inherit",
    });
    if (result.status !== 0) {
        throw new Error("prisma migrate deploy failed. No data was deleted.");
    }
}

function loadOrCreatePassword() {
    if (existsSync(usersPath)) {
        const current = JSON.parse(readFileSync(usersPath, "utf8"));
        if (!current.password) {
            throw new Error(`${usersPath} exists but has no password. Refusing to invent a second one.`);
        }
        return current.password;
    }
    return randomBytes(18).toString("base64url");
}

function names(prefix, count) {
    return Array.from({ length: count }, (_, index) => {
        const suffix = String(index + 1).padStart(2, "0");
        return `loadtest-${prefix}-${suffix}`;
    });
}

async function upsertUser(prisma, username, roleId, passwordHash, employeeId, resetPassword) {
    const user = await prisma.user.upsert({
        where: { username },
        update: resetPassword
            ? { status: "ACTIVE", failedAttempts: 0, password: passwordHash }
            : { status: "ACTIVE", failedAttempts: 0 },
        create: {
            employeeId,
            fullName: `LOADTEST ${username}`,
            username,
            password: passwordHash,
            status: "ACTIVE",
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
    });
    return user;
}

async function seedMasters(prisma) {
    const passwordIsNew = !existsSync(usersPath);
    const password = loadOrCreatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const roles = {};
    for (const name of ["ADMIN", "RECEPTION", "BILLING"]) {
        roles[name] = await prisma.role.upsert({
            where: { name },
            update: {},
            create: { name, description: `LOADTEST ${name}` },
        });
    }

    const reception = [];
    const billing = [];
    const admin = [];
    for (const username of names("reception", 8)) {
        reception.push(await upsertUser(prisma, username, roles.RECEPTION.id, passwordHash, `LT-R${username.slice(-2)}`, passwordIsNew));
    }
    for (const username of names("billing", 4)) {
        billing.push(await upsertUser(prisma, username, roles.BILLING.id, passwordHash, `LT-B${username.slice(-2)}`, passwordIsNew));
    }
    for (const username of names("admin", 2)) {
        admin.push(await upsertUser(prisma, username, roles.ADMIN.id, passwordHash, `LT-A${username.slice(-2)}`, passwordIsNew));
    }

    const departments = [];
    for (const entry of [
        ["LT-GEN", "LOADTEST General"],
        ["LT-MED", "LOADTEST Medicine"],
        ["LT-SUR", "LOADTEST Surgery"],
    ]) {
        departments.push(await prisma.department.upsert({
            where: { code: entry[0] },
            update: { status: "ACTIVE" },
            create: { code: entry[0], name: entry[1], status: "ACTIVE" },
        }));
    }

    await prisma.patientScheme.upsert({
        where: { code: "LOADTEST" },
        update: { status: "ACTIVE" },
        create: {
            code: "LOADTEST",
            name: "LOADTEST Scheme",
            eligibilityGender: "ALL",
            ageCriteriaType: "ALL",
            status: "ACTIVE",
        },
    });

    const service = await prisma.billingService.upsert({
        where: { name: "LOADTEST Consultation" },
        update: { isActive: true },
        create: {
            name: "LOADTEST Consultation",
            description: "Synthetic catalog item for load tests",
            isActive: true,
            createdBy: admin[0].id,
        },
    });
    const tariff = await prisma.serviceTariff.findFirst({
        where: { serviceId: service.id, category: "APL", endedAt: null },
    });
    if (!tariff) {
        await prisma.serviceTariff.create({
            data: {
                serviceId: service.id,
                category: "APL",
                amount: "100.00",
                isFree: false,
                createdBy: admin[0].id,
            },
        });
        await prisma.serviceTariff.create({
            data: {
                serviceId: service.id,
                category: "BPL",
                amount: "0.00",
                isFree: true,
                createdBy: admin[0].id,
            },
        });
    }
    const apl = await prisma.serviceTariff.findFirst({
        where: { serviceId: service.id, category: "APL", endedAt: null },
    });

    for (let index = 1; index <= 30; index += 1) {
        const uhid = `UHID-LT-SEED-${String(index).padStart(4, "0")}`;
        const existing = await prisma.patient.findUnique({ where: { uhid } });
        if (!existing) {
            await prisma.patient.create({
                data: {
                    uhid,
                    firstName: "LOADTEST",
                    lastName: `Seed${String(index).padStart(2, "0")}`,
                    age: 30 + (index % 40),
                    gender: index % 2 === 0 ? "FEMALE" : "MALE",
                    phone: `990${String(index).padStart(7, "0")}`,
                    city: "LOADTEST",
                    addressLine1: "LOADTEST synthetic record",
                    createdBy: reception[0].id,
                },
            });
        }
    }
    const sample = await prisma.patient.findUnique({ where: { uhid: "UHID-LT-SEED-0001" } });

    const catalog = {
        password,
        reception: reception.map((user) => ({ username: user.username })),
        billing: billing.map((user) => ({ username: user.username })),
        admin: admin.map((user) => ({ username: user.username })),
        departmentId: departments[0].id,
        serviceId: service.id,
        tariffId: apl.id,
        samplePatientId: sample.id,
        receptionUserId: reception[0].id,
        billingUserId: billing[0].id,
    };
    writeFileSync(usersPath, `${JSON.stringify(catalog, null, 2)}\n`, { mode: 0o600 });
    chmodSync(usersPath, 0o600);
    console.log(`Wrote ${usersPath}. The password is only in that file.`);
    return catalog;
}

async function seedBulk(prisma, catalog) {
    if (process.env.SEED_BULK !== "1" || process.env.SEED_BULK_CONFIRM !== ALLOWED_DATABASE) {
        console.log("Skipped bulk rows. Set SEED_BULK=1 and SEED_BULK_CONFIRM=hospital_management_loadtest to add them.");
        return;
    }
    await assertLive(prisma, "insert bulk rows");
    const present = await prisma.patient.count({ where: { uhid: { startsWith: "UHID-LT-BULK-" } } });
    if (present > 0) {
        throw new Error(`Bulk patients already exist (${present}). Refusing to insert or delete them.`);
    }

    console.log(`Inserting ${BULK_PATIENTS} patients, ${BULK_VISITS} visits, and ${BULK_BILLS} bills.`);
    const batch = 5000;
    for (let start = 1; start <= BULK_PATIENTS; start += batch) {
        const end = Math.min(BULK_PATIENTS, start + batch - 1);
        await assertLive(prisma, "insert bulk patients");
        await prisma.$executeRaw`
            INSERT INTO "Patient" (
                "uhid", "firstName", "lastName", "age", "gender", "phone", "city",
                "addressLine1", "status", "createdBy", "schemeAdditionalInformation",
                "createdAt", "updatedAt"
            )
            SELECT
                'UHID-LT-BULK-' || lpad(g::text, 8, '0'),
                'LOADTEST',
                'Bulk' || g::text,
                20 + (g % 60),
                CASE WHEN g % 2 = 0 THEN 'FEMALE'::"Gender" ELSE 'MALE'::"Gender" END,
                '992' || lpad(g::text, 7, '0'),
                'LOADTEST',
                'LOADTEST synthetic record',
                'ACTIVE'::"RecordStatus",
                ${catalog.receptionUserId},
                '[]'::jsonb,
                NOW(),
                NOW()
            FROM generate_series(${start}::int, ${end}::int) AS g
            WHERE current_database() = 'hospital_management_loadtest'
        `;
    }

    for (let start = 1; start <= BULK_VISITS; start += batch) {
        const end = Math.min(BULK_VISITS, start + batch - 1);
        await assertLive(prisma, "insert bulk visits");
        await prisma.$executeRaw`
            INSERT INTO "PatientVisit" (
                "visitNumber", "tokenNumber", "tokenPrefix", "tokenLabel", "tokenDate",
                "visitDate", "visitType", "revisitCount", "status", "patientId",
                "departmentId", "createdBy", "opFee", "discountAmount", "finalFee",
                "paymentStatus", "paymentMethod", "createdAt", "updatedAt"
            )
            SELECT
                'LT-VISIT-' || g,
                (g / 180) + 1,
                'HMS',
                'HMS ' || ((g / 180) + 1)::text,
                (CURRENT_DATE - ((g % 180) || ' days')::interval)::date,
                NOW() - ((g % 180) || ' days')::interval,
                'NEW'::"VisitType",
                0,
                'REGISTERED'::"VisitStatus",
                patient.id,
                ${catalog.departmentId},
                ${catalog.receptionUserId},
                10,
                0,
                10,
                'PAID'::"PaymentStatus",
                'CASH'::"PaymentMethod",
                NOW() - ((g % 180) || ' days')::interval,
                NOW()
            FROM generate_series(${start}::int, ${end}::int) AS g
            JOIN "Patient" AS patient
              ON patient.uhid = 'UHID-LT-BULK-' || lpad(((g % ${BULK_PATIENTS}) + 1)::text, 8, '0')
            WHERE current_database() = 'hospital_management_loadtest'
        `;
    }

    for (let start = 1; start <= BULK_BILLS; start += batch) {
        const end = Math.min(BULK_BILLS, start + batch - 1);
        await assertLive(prisma, "insert bulk bills");
        await prisma.$executeRaw`
            WITH inserted AS (
                INSERT INTO "Bill" (
                    "billNumber", "idempotencyKey", "patientId", "createdBy", "category",
                    "grossAmount", "discountAmount", "miscellaneousDiscountAmount",
                    "netPayable", "status", "createdAt", "updatedAt"
                )
                SELECT
                    'LT-BILL-' || g,
                    'lt-bulk-' || g,
                    patient.id,
                    ${catalog.billingUserId},
                    'APL'::"BillingCategory",
                    100,
                    0,
                    0,
                    100,
                    'PAID'::"BillingStatus",
                    NOW() - ((g % 180) || ' days')::interval,
                    NOW()
                FROM generate_series(${start}::int, ${end}::int) AS g
                JOIN "Patient" AS patient
                  ON patient.uhid = 'UHID-LT-BULK-' || lpad(((g % ${BULK_PATIENTS}) + 1)::text, 8, '0')
                WHERE current_database() = 'hospital_management_loadtest'
                RETURNING id, "billNumber", "createdBy", "createdAt", "idempotencyKey"
            )
            INSERT INTO "BillPayment" (
                "billId", "handledBy", "method", "amount", "status", "idempotencyKey", "confirmedAt"
            )
            SELECT id, "createdBy", 'CASH'::"PaymentMethod", 100, 'CONFIRMED'::"BillingPaymentStatus",
                   "idempotencyKey" || ':payment', "createdAt"
            FROM inserted
        `;
        await assertLive(prisma, "insert bulk bill items");
        await prisma.$executeRaw`
            INSERT INTO "BillItem" (
                "billId", "serviceId", "tariffId", "serviceNameSnapshot", "quantity",
                "tariffUnitPrice", "grossAmount", "discountAmount", "netAmount", "discountSnapshot"
            )
            SELECT bill.id, ${catalog.serviceId}, ${catalog.tariffId}, 'LOADTEST Consultation', 1,
                   100, 100, 0, 100, '{}'::jsonb
            FROM "Bill" AS bill
            WHERE bill."billNumber" LIKE 'LT-BILL-%'
              AND NOT EXISTS (SELECT 1 FROM "BillItem" AS item WHERE item."billId" = bill.id)
              AND current_database() = 'hospital_management_loadtest'
        `;
    }
}

async function main() {
    const target = testDatabaseUrl();
    refuse("start seeding", target.database);
    console.log(`Load-test database ${target.database} at ${target.host}:${target.port}.`);
    await ensureDatabase(target);
    migrate(target);
    process.env.DATABASE_URL = target.url;
    const prisma = new PrismaClient();
    try {
        await assertLive(prisma, "seed synthetic rows");
        const catalog = await seedMasters(prisma);
        await seedBulk(prisma, catalog);
        console.log("Seed finished. No database was dropped.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});

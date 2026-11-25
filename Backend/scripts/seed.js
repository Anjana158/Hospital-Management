const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const MASTER_DATA_FILE = path.resolve(__dirname, "../prisma/seed-data/master-data.json");

function toDate(value) {
    if (value === null || value === undefined) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date value: ${value}`);
    }
    return date;
}

function normalizeDepartment(row) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        status: row.status,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
    };
}

function normalizeScheme(row) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        eligibilityGender: row.eligibilityGender,
        ageCriteriaType: row.ageCriteriaType,
        ageLimit: row.ageLimit,
        minimumAge: row.minimumAge,
        maximumAge: row.maximumAge,
        collectAdditionalInformation: row.collectAdditionalInformation,
        additionalInformationFields: row.additionalInformationFields ?? [],
        status: row.status,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
    };
}

function normalizeService(row, createdBy) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: row.isActive,
        createdBy,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
    };
}

function normalizeTariff(row, createdBy) {
    return {
        id: row.id,
        serviceId: row.serviceId,
        category: row.category,
        amount: row.amount,
        isFree: row.isFree,
        effectiveAt: toDate(row.effectiveAt),
        endedAt: row.endedAt ? toDate(row.endedAt) : null,
        createdBy,
    };
}

async function upsertInsertMissingById(tx, modelName, data) {
    const delegate = tx[modelName];
    if (!delegate) throw new Error(`Unknown Prisma model delegate: ${modelName}`);
    await delegate.upsert({
        where: { id: data.id },
        create: data,
        update: {},
    });
}

async function resetSequence(tx, tableName) {
    await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${tableName}"))`
    );
}

async function resolveCreatorId(tx, originalCreatedBy, adminUserId, cache) {
    if (cache.has(originalCreatedBy)) return cache.get(originalCreatedBy);

    const existing = await tx.user.findUnique({
        where: { id: originalCreatedBy },
        select: { id: true },
    });
    if (existing) {
        cache.set(originalCreatedBy, existing.id);
        return existing.id;
    }

    cache.set(originalCreatedBy, adminUserId);
    return adminUserId;
}

async function seedMasterData(tx, adminUserId) {
    if (!fs.existsSync(MASTER_DATA_FILE)) {
        throw new Error(`Master data file not found: ${MASTER_DATA_FILE}`);
    }

    const payload = JSON.parse(fs.readFileSync(MASTER_DATA_FILE, "utf8"));
    const departments = Array.isArray(payload.departments) ? payload.departments : [];
    const schemes = Array.isArray(payload.schemes) ? payload.schemes : [];
    const services = Array.isArray(payload.billingServices) ? payload.billingServices : [];
    const tariffs = Array.isArray(payload.serviceTariffs) ? payload.serviceTariffs : [];

    console.log(
        `Loaded master data: departments=${departments.length}, schemes=${schemes.length}, services=${services.length}, tariffs=${tariffs.length}`
    );

    for (const row of departments) {
        await upsertInsertMissingById(tx, "department", normalizeDepartment(row));
    }
    if (departments.length > 0) await resetSequence(tx, "Department");
    console.log("Departments initialized");

    for (const row of schemes) {
        await upsertInsertMissingById(tx, "patientScheme", normalizeScheme(row));
    }
    if (schemes.length > 0) await resetSequence(tx, "PatientScheme");
    console.log("Patient schemes initialized");

    const creatorCache = new Map();
    for (const row of services) {
        const createdBy = await resolveCreatorId(tx, row.createdBy, adminUserId, creatorCache);
        await upsertInsertMissingById(tx, "billingService", normalizeService(row, createdBy));
    }
    if (services.length > 0) await resetSequence(tx, "BillingService");
    console.log("Billing services initialized");

    for (const row of tariffs) {
        const createdBy = await resolveCreatorId(tx, row.createdBy, adminUserId, creatorCache);
        await upsertInsertMissingById(tx, "serviceTariff", normalizeTariff(row, createdBy));
    }
    if (tariffs.length > 0) await resetSequence(tx, "ServiceTariff");
    console.log("Service tariffs initialized");

    return {
        departments: departments.length,
        schemes: schemes.length,
        services: services.length,
        tariffs: tariffs.length,
    };
}

async function main() {
    console.log("Starting database seed...");

    // 1. Create the default roles
    const adminRole = await prisma.role.upsert({
        where: {
            name: "ADMIN",
        },
        update: {},
        create: {
            name: "ADMIN",
            description: "System Administrator",
        },
    });

    const receptionRole = await prisma.role.upsert({
        where: {
            name: "RECEPTION",
        },
        update: {},
        create: {
            name: "RECEPTION",
            description: "Reception Staff",
        },
    });

    const billingRole = await prisma.role.upsert({
        where: {
            name: "BILLING",
        },
        update: {},
        create: {
            name: "BILLING",
            description: "Billing Staff",
        },
    });

    console.log("Roles created successfully");

    // 2. Hash the admin password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // 3. Create the default admin user
    const admin = await prisma.user.upsert({
        where: {
            username: "admin",
        },
        update: {},
        create: {
            employeeId: "EMP001",
            fullName: "System Administrator",
            username: "admin",
            password: hashedPassword,
            userRoles: {
                create: {
                    roleId: adminRole.id,
                },
            },
        },
    });

    console.log("Admin created successfully");
    console.log("Username:", admin.username);
    console.log("Employee ID:", admin.employeeId);

    // 4. Initialize master data from the controlled deployment asset
    const masterDataSummary = await prisma.$transaction(async (tx) => {
        return seedMasterData(tx, admin.id);
    }, { timeout: 300000 });

    console.log("Master data initialized successfully");
    console.log(JSON.stringify(masterDataSummary, null, 2));
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
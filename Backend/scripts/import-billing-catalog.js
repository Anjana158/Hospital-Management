#!/usr/bin/env node

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { readServiceCatalogue, normalizedName } = require("../src/modules/billing/serviceCatalogImport");

function option(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? null : process.argv[index + 1] || null;
}

function expectedDatabaseTarget(databaseUrl) {
    const parsed = new URL(databaseUrl);
    return `${parsed.hostname}/${decodeURIComponent(parsed.pathname.replace(/^\/+/, ""))}`;
}

function assertConfirmedTarget(databaseUrl) {
    const expected = expectedDatabaseTarget(databaseUrl);
    if (option("--confirm-target") !== expected) {
        throw new Error(`Database target confirmation required: pass --confirm-target "${expected}"`);
    }
}

async function main() {
    const filePath = option("--file");
    if (!filePath) throw new Error('Provide the workbook path with --file "path-to-workbook.xlsx"');
    const parsed = await readServiceCatalogue(path.resolve(filePath));
    let recordsToImport = parsed.records;
    const skippedRecords = [];
    const applying = process.argv.includes("--apply");
    const confirmedTarget = option("--confirm-target");
    let prisma;

    if (applying || confirmedTarget) {
        if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured in Backend/.env");
        assertConfirmedTarget(process.env.DATABASE_URL);
        ({ prisma } = require("../src/config/prisma"));
        const existingServices = await prisma.billingService.findMany({ select: { name: true } });
        const existingNames = new Set(existingServices.map((service) => normalizedName(service.name)));
        recordsToImport = parsed.records.filter((record) => {
            if (!existingNames.has(normalizedName(record.name))) return true;
            skippedRecords.push({
                rowNumber: record.rowNumber,
                name: record.name,
                reason: "Service already exists; existing service and tariffs were not changed",
            });
            return false;
        });
    }

    const summary = {
        workbook: path.basename(filePath),
        worksheet: parsed.worksheetName,
        totalRecords: parsed.totalRecords,
        imported: 0,
        updated: 0,
        skipped: skippedRecords.length,
        invalid: parsed.invalidRecords.length,
        databaseTarget: confirmedTarget || "not checked; preview only",
        existingServicesChecked: Boolean(confirmedTarget),
        candidateRecords: recordsToImport.map(({ rowNumber, name, aplAmount, bplAmount }) => ({
            rowNumber, name, aplAmount, bplAmount,
        })),
        invalidRecords: parsed.invalidRecords,
        skippedRecords,
    };

    if (!applying) {
        summary.importable = recordsToImport.length;
        console.log(JSON.stringify(summary, null, 2));
        if (prisma) await prisma.$disconnect();
        return;
    }

    const actorId = Number(option("--actor-id"));
    if (!Number.isInteger(actorId) || actorId < 1) {
        throw new Error("Applying requires --actor-id <active-admin-user-id> for the audit trail");
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const actor = await tx.user.findFirst({
                where: {
                    id: actorId,
                    status: "ACTIVE",
                    userRoles: { some: { role: { name: "ADMIN" } } },
                },
                select: { id: true },
            });
            if (!actor) throw new Error("The audit actor must be an active Admin user");

            const existingServices = await tx.billingService.findMany({ select: { name: true } });
            const existingNames = new Set(existingServices.map((service) => normalizedName(service.name)));
            const importedRecords = [];
            const finalSkipped = [...skippedRecords];
            for (const record of recordsToImport) {
                if (existingNames.has(normalizedName(record.name))) {
                    finalSkipped.push({
                        rowNumber: record.rowNumber,
                        name: record.name,
                        reason: "Service already exists; existing service and tariffs were not changed",
                    });
                    continue;
                }
                await tx.billingService.create({
                    data: {
                        name: record.name,
                        isActive: true,
                        createdBy: actorId,
                        tariffs: {
                            create: [
                                { category: "APL", amount: record.aplAmount.toFixed(2), createdBy: actorId },
                                { category: "BPL", amount: record.bplAmount.toFixed(2), createdBy: actorId },
                            ],
                        },
                    },
                });
                existingNames.add(normalizedName(record.name));
                importedRecords.push(record);
            }

            await tx.billingAudit.create({
                data: {
                    actorId,
                    action: "SERVICE_CATALOG_IMPORTED",
                    entityType: "SERVICE_CATALOG",
                    entityId: path.basename(filePath),
                    details: {
                        imported: importedRecords.length,
                        updated: 0,
                        skipped: finalSkipped.length,
                        invalid: parsed.invalidRecords.length,
                    },
                },
            });
            return { importedRecords, skippedRecords: finalSkipped };
        }, { isolationLevel: "Serializable", timeout: 120000 });
        summary.imported = result.importedRecords.length;
        summary.skipped = result.skippedRecords.length;
        summary.skippedRecords = result.skippedRecords;
        summary.candidateRecords = result.importedRecords.map(({ rowNumber, name, aplAmount, bplAmount }) => ({
            rowNumber, name, aplAmount, bplAmount,
        }));
        console.log(JSON.stringify(summary, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`Billing catalogue import failed: ${error.message}`);
    process.exitCode = 1;
});

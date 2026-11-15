const ExcelJS = require("exceljs");

function normalizedName(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US");
}

function cellValue(cell) {
    const value = cell.value;
    if (value === null || value === undefined) return "";
    if (typeof value === "number" || typeof value === "string") return value;
    return value;
}

function sourcePriceValue(value) {
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
    if (typeof value === "number" || typeof value === "string") return value;
    return JSON.stringify(value);
}

function parsePrice(value, label, errors) {
    if (value === "" || (typeof value === "string" && !value.trim())) {
        errors.push(`${label} price is missing`);
        return null;
    }
    if (typeof value !== "number" && typeof value !== "string") {
        errors.push(`${label} price must be a numeric cell or value`);
        return null;
    }
    const text = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        errors.push(`${label} price must be a non-negative amount with at most two decimals`);
        return null;
    }
    const price = Number(text);
    if (!Number.isFinite(price) || price > 99999999.99) {
        errors.push(`${label} price exceeds the supported amount`);
        return null;
    }
    if (price === 0) {
        errors.push(`${label} price is zero without an explicit free setting; review manually`);
        return null;
    }
    return Number(price.toFixed(2));
}

function validateWorksheet(worksheet) {
    let columns;
    let headerRow;
    worksheet.eachRow((row, rowNumber) => {
        if (columns) return;
        const candidate = new Map();
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
            const value = cell.value;
            if (typeof value === "string") candidate.set(value.trim().toUpperCase(), columnNumber);
        });
        if (
            candidate.has("SERVICE NAME") &&
            candidate.has("BPL CHARGE") &&
            candidate.has("APL CHARGE")
        ) {
            columns = {
                service: candidate.get("SERVICE NAME"),
                bpl: candidate.get("BPL CHARGE"),
                apl: candidate.get("APL CHARGE"),
            };
            headerRow = rowNumber;
        }
    });
    if (!columns) {
        throw new Error("Workbook must contain SERVICE NAME, BPL CHARGE, and APL CHARGE columns");
    }

    const records = [];
    const invalidRecords = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRow) return;
        const rawName = cellValue(row.getCell(columns.service));
        const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
        const rawBpl = cellValue(row.getCell(columns.bpl));
        const rawApl = cellValue(row.getCell(columns.apl));
        if (!name && (rawBpl === "" || rawBpl === null) && (rawApl === "" || rawApl === null)) return;

        const errors = [];
        if (!name) errors.push("Service name is missing or not text");
        else if (name.length > 150) errors.push("Service name exceeds 150 characters");
        const bplAmount = parsePrice(rawBpl, "BPL", errors);
        const aplAmount = parsePrice(rawApl, "APL", errors);
        const record = { rowNumber, name, bplAmount, aplAmount };
        if (errors.length) {
            invalidRecords.push({
                ...record,
                bplValue: sourcePriceValue(rawBpl),
                aplValue: sourcePriceValue(rawApl),
                reasons: errors,
            });
        }
        else records.push(record);
    });

    const duplicates = new Map();
    for (const record of [...records, ...invalidRecords].filter((row) => row.name)) {
        const key = normalizedName(record.name);
        duplicates.set(key, [...(duplicates.get(key) || []), record]);
    }
    const duplicateRecords = [...duplicates.values()].filter((group) => group.length > 1).flat();
    const duplicateRows = new Set(duplicateRecords.map((record) => record.rowNumber));
    for (const record of duplicateRecords) {
        const existingInvalid = invalidRecords.find((row) => row.rowNumber === record.rowNumber);
        if (existingInvalid) {
            existingInvalid.reasons.push("Duplicate service name in workbook; all matching rows require review");
        } else {
            invalidRecords.push({
                ...record,
                reasons: ["Duplicate service name in workbook; all matching rows require review"],
            });
        }
    }
    const validRecords = records.filter((record) => !duplicateRows.has(record.rowNumber));

    return {
        totalRecords: validRecords.length + invalidRecords.length,
        records: validRecords,
        invalidRecords: invalidRecords.sort((a, b) => a.rowNumber - b.rowNumber),
        worksheetName: worksheet.name,
    };
}

async function readServiceCatalogue(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets.find((sheet) => sheet.rowCount > 0);
    if (!worksheet) throw new Error("Workbook has no populated worksheet");
    return validateWorksheet(worksheet);
}

module.exports = { normalizedName, readServiceCatalogue, validateWorksheet };

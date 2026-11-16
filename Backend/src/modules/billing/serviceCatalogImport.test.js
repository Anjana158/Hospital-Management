const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { validateWorksheet } = require("./serviceCatalogImport");

function worksheetWithRows(rows) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Charges");
    rows.forEach((row) => worksheet.addRow(row));
    return worksheet;
}

test("maps the workbook's service and APL/BPL charge columns", () => {
    const worksheet = worksheetWithRows([
        ["SERVICES AND ITS CHARGES"],
        ["SL NO", "SERVICE NAME ", "BPL CHARGE ", "APL CHARGE"],
        [1, " X-RAY CHEST ", 80, 120],
    ]);

    const result = validateWorksheet(worksheet);
    assert.equal(result.records.length, 1);
    assert.deepEqual(result.records[0], {
        rowNumber: 3,
        name: "X-RAY CHEST",
        bplAmount: 80,
        aplAmount: 120,
    });
    assert.equal(result.invalidRecords.length, 0);
});

test("rejects missing, invalid, and unmarked zero tariffs", () => {
    const worksheet = worksheetWithRows([
        ["SERVICE NAME", "BPL CHARGE", "APL CHARGE"],
        ["MISSING BPL", null, 50],
        ["INVALID APL", 20, "unknown"],
        ["ZERO PRICE", 0, 10],
    ]);

    const result = validateWorksheet(worksheet);
    assert.equal(result.records.length, 0);
    assert.equal(result.invalidRecords.length, 3);
    assert.match(result.invalidRecords[0].reasons.join(" "), /BPL price is missing/);
    assert.equal(result.invalidRecords[0].bplValue, null);
    assert.match(result.invalidRecords[1].reasons.join(" "), /APL price must be a non-negative amount/);
    assert.match(result.invalidRecords[2].reasons.join(" "), /zero without an explicit free setting/);
    assert.equal(result.invalidRecords[2].bplValue, 0);
});

test("marks every duplicate service row invalid without importing either", () => {
    const worksheet = worksheetWithRows([
        ["SERVICE NAME", "BPL CHARGE", "APL CHARGE"],
        ["LAB TEST", 40, 50],
        [" lab   test ", 45, 55],
    ]);

    const result = validateWorksheet(worksheet);
    assert.equal(result.records.length, 0);
    assert.equal(result.invalidRecords.length, 2);
    assert.ok(result.invalidRecords.every((record) => record.reasons[0].includes("Duplicate service name")));
});

test("marks a duplicate invalid even when its tariff row is already invalid", () => {
    const worksheet = worksheetWithRows([
        ["SERVICE NAME", "BPL CHARGE", "APL CHARGE"],
        ["LAB TEST", null, 50],
        [" lab test ", 45, 55],
    ]);

    const result = validateWorksheet(worksheet);
    assert.equal(result.records.length, 0);
    assert.equal(result.invalidRecords.length, 2);
    assert.ok(result.invalidRecords.every((record) => record.reasons.some((reason) => reason.includes("Duplicate service name"))));
});

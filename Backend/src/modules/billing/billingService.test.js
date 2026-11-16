const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyMiscellaneousAmount,
    assertBillRequestMatches,
    calculateBill,
    initialPaymentForBill,
    paymentEventCount,
    paymentEvents,
} = require("./billingService");

const scheme = {
    id: 3,
    code: "CARE",
    name: "Care Scheme",
    eligibilityGender: "ALL",
    ageCriteriaType: "ALL",
    ageLimit: null,
    minimumAge: null,
    maximumAge: null,
    collectAdditionalInformation: false,
    additionalInformationFields: [],
};

function service(id, name, amountValue, category = "APL") {
    return {
        id,
        name,
        tariffs: [{
            id: id + 10,
            category,
            amount: amountValue,
            isFree: amountValue === "0.00",
            endedAt: null,
        }],
    };
}

test("an applied scheme applies a fixed 100% discount to every billed service", () => {
    const result = calculateBill("APL", [
        { serviceId: 1, quantity: 1 },
        { serviceId: 2, quantity: 1 },
    ], [service(1, "Consultation", "100.00"), service(2, "Lab", "100.00")], scheme);

    assert.equal(result.gross, 20000);
    assert.equal(result.discount, 20000);
    assert.equal(result.net, 0);
    assert.equal(result.items[0].discountAmount, "100.00");
    assert.equal(result.items[0].discountSnapshot.schemeDiscount, "100.00");
    assert.equal(result.schemeSnapshot.discountValue, 100);
});

test("billing without an assigned scheme preserves the service tariff", () => {
    const result = calculateBill("APL", [{ serviceId: 1, quantity: 1 }], [
        service(1, "Consultation", "100.00"),
    ], null);
    assert.equal(result.discount, 0);
    assert.equal(result.net, 10000);
});

test("miscellaneous amount is treated as final payable and the difference as discount", () => {
    assert.deepEqual(applyMiscellaneousAmount(100000, 400), {
        amount: 40000,
        discount: 60000,
        net: 40000,
    });
    assert.deepEqual(applyMiscellaneousAmount(100000, null), {
        amount: null,
        discount: 0,
        net: 100000,
    });
    assert.deepEqual(applyMiscellaneousAmount(100000, 0), {
        amount: 0,
        discount: 100000,
        net: 0,
    });
    assert.throws(() => applyMiscellaneousAmount(100000, 1001), {
        code: "BILLING_INVALID_MISCELLANEOUS_AMOUNT",
    });
    assert.throws(() => applyMiscellaneousAmount(100000, -1), {
        code: "BILLING_INVALID_AMOUNT",
    });
});

test("initial payment always equals the final payable and zero-payable bills have no payment", () => {
    assert.deepEqual(initialPaymentForBill(40000, "CASH", false), {
        amount: "400.00",
        method: "CASH",
    });
    assert.deepEqual(initialPaymentForBill(40000, "GPAY", true), {
        amount: "400.00",
        method: "GPAY",
    });
    assert.equal(initialPaymentForBill(0, null, false), null);
    assert.throws(() => initialPaymentForBill(40000, null, false), {
        code: "BILLING_PAYMENT_METHOD_REQUIRED",
    });
    assert.throws(() => initialPaymentForBill(40000, "GPAY", false), {
        code: "BILLING_GPAY_CONFIRMATION_REQUIRED",
    });
    assert.throws(() => initialPaymentForBill(0, "CASH", false), {
        code: "BILLING_ZERO_PAYABLE",
    });
});

test("BPL bills use the BPL tariff rather than the APL tariff", () => {
    const result = calculateBill("BPL", [{ serviceId: 1, quantity: 2 }], [
        service(1, "Consultation", "40.00", "BPL"),
    ], null);

    assert.equal(result.gross, 8000);
    assert.equal(result.items[0].tariffUnitPrice, "40.00");
});

test("missing category tariffs fail instead of becoming zero-priced services", () => {
    assert.throws(
        () => calculateBill("BPL", [{ serviceId: 1, quantity: 1 }], [service(1, "Consultation", "100.00")], null),
        { code: "BILLING_MISSING_TARIFF" }
    );
});

test("payment reports retain the original collection event and count a later reversal separately", () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    const end = new Date("2026-10-31T23:59:59.999Z");
    const reversedLater = paymentEvents({
        status: "REVERSED",
        confirmedAt: new Date("2026-10-12T10:00:00.000Z"),
        reversedAt: new Date("2026-11-02T10:00:00.000Z"),
    }, start, end);
    const reversedWithinRange = paymentEvents({
        status: "REVERSED",
        confirmedAt: new Date("2026-10-12T10:00:00.000Z"),
        reversedAt: new Date("2026-10-14T10:00:00.000Z"),
    }, start, end);

    assert.deepEqual(reversedLater, { collected: true, reversed: false });
    assert.deepEqual(reversedWithinRange, { collected: true, reversed: true });
    assert.equal(paymentEventCount({
        status: "REVERSED",
        confirmedAt: new Date("2026-10-12T10:00:00.000Z"),
        reversedAt: new Date("2026-10-14T10:00:00.000Z"),
    }, start, end), 2);
});

test("bill idempotency checks include remarks so retries cannot silently change them", () => {
    const bill = {
        patientId: 7,
        category: "APL",
        remarks: "Bring prior records",
        netPayable: "100.00",
        items: [{ serviceId: 3, quantity: 1 }],
        payments: [{
            idempotencyKey: "bill-request-123:payment",
            method: "CASH",
            amount: "100.00",
        }],
    };
    const request = {
        patientId: 7,
        category: "APL",
        remarks: "Bring prior records",
        items: [{ serviceId: 3, quantity: 1 }],
        paymentMethod: "CASH",
        idempotencyKey: "bill-request-123",
    };

    assert.doesNotThrow(() => assertBillRequestMatches(bill, request));
    assert.throws(
        () => assertBillRequestMatches(bill, { ...request, remarks: "Different note" }),
        { code: "BILLING_IDEMPOTENCY_CONFLICT" }
    );

    const adjustedBill = {
        ...bill,
        netPayable: "400.00",
        miscellaneousAmount: "400.00",
        payments: [{
            idempotencyKey: "bill-request-123:payment",
            method: "CASH",
            amount: "400.00",
        }],
    };
    assert.doesNotThrow(() => assertBillRequestMatches(adjustedBill, {
        ...request,
        miscellaneousAmount: 400,
    }));
    assert.throws(() => assertBillRequestMatches(adjustedBill, {
        ...request,
        miscellaneousAmount: 401,
    }), { code: "BILLING_IDEMPOTENCY_CONFLICT" });
});

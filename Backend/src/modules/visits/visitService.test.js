const test = require("node:test");
const assert = require("node:assert/strict");

const {
    calculateVisitAmounts,
    getVisitPaymentDetails,
    registerVisitSchema,
} = require("./visitService");

test("an eligible OP scheme waives the complete visit fee", () => {
    assert.deepEqual(calculateVisitAmounts(125.5, { id: 1 }), {
        discountAmount: 125.5,
        finalFee: 0,
    });
});

test("visits without an eligible scheme retain the normal OP fee", () => {
    assert.deepEqual(calculateVisitAmounts(125.5, null), {
        discountAmount: 0,
        finalFee: 125.5,
    });
});

test("OP registration accepts a receptionist-selected scheme ID", () => {
    const visit = registerVisitSchema.parse({
        patientId: 7,
        departmentId: 2,
        schemeId: 19,
        opFee: 10,
    });

    assert.equal(visit.schemeId, 19);

    const withoutScheme = registerVisitSchema.parse({
        patientId: 7,
        departmentId: 2,
        schemeId: null,
        opFee: 10,
    });
    assert.equal(withoutScheme.schemeId, null);
});

test("OP registration accepts an unpaid visit without a payment method", () => {
    const visit = registerVisitSchema.parse({
        patientId: 7,
        departmentId: 2,
        opFee: 10,
    });

    assert.equal(visit.paymentMethod, undefined);
    assert.deepEqual(getVisitPaymentDetails(10, visit.paymentMethod), {
        paymentStatus: "PENDING",
        paymentMethod: null,
    });
});

test("zero-payable scheme visits remain free without payment details", () => {
    assert.deepEqual(getVisitPaymentDetails(0, undefined), {
        paymentStatus: "FREE",
        paymentMethod: null,
    });
});

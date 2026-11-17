const test = require("node:test");
const assert = require("node:assert/strict");
const { prisma } = require("../../config/prisma");

const {
    calculateVisitAmounts,
    getVisitPaymentDetails,
    registerVisitRecord,
    registerVisitSchema,
    validateVisitPayment,
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

test("zero-payable scheme visits are free and recorded with the cash method", () => {
    assert.deepEqual(getVisitPaymentDetails(0, undefined), {
        paymentStatus: "FREE",
        paymentMethod: "CASH",
    });
});

test("POS visits require an auth code when a payment is due", () => {
    const visit = {
        patientId: 7,
        departmentId: 2,
        paymentMethod: "POS",
        opFee: 10,
    };

    assert.equal(registerVisitSchema.safeParse(visit).success, true);
    assert.throws(() => validateVisitPayment(10, "POS", undefined), {
        code: "VISIT_PAYMENT_VALIDATION_ERROR",
    });
    assert.equal(registerVisitSchema.safeParse({
        ...visit,
        authCode: "A123",
    }).success, true);
    assert.doesNotThrow(() => validateVisitPayment(0, "CASH", undefined));
});

test("visit registration accepts only current payment methods", () => {
    const baseVisit = {
        patientId: 7,
        departmentId: 2,
        opFee: 10,
    };

    assert.equal(registerVisitSchema.safeParse({
        ...baseVisit,
        paymentMethod: "CASH",
    }).success, true);
    assert.equal(registerVisitSchema.safeParse({
        ...baseVisit,
        paymentMethod: "POS",
    }).success, true);
    assert.equal(registerVisitSchema.safeParse({
        ...baseVisit,
        paymentMethod: "GPAY",
    }).success, false);
});

test("POS auth codes are persisted on the generated visit and visit type comes from history", async () => {
    const originalTransaction = prisma.$transaction;
    let createdVisitData;
    const patient = {
        id: 7,
        status: "ACTIVE",
        gender: "FEMALE",
        age: 34,
        dateOfBirth: null,
        scheme: null,
    };
    const department = { id: 2, status: "ACTIVE" };
    const tx = {
        patient: { findUnique: async () => patient },
        department: { findUnique: async () => department },
        patientScheme: { findMany: async () => [] },
        patientVisit: {
            findFirst: async () => null,
            findMany: async () => [{ id: 1 }, { id: 2 }],
            create: async ({ data }) => {
                createdVisitData = data;
                return { ...data, id: 10, visitDate: new Date() };
            },
            update: async ({ data }) => ({
                ...createdVisitData,
                ...data,
                id: 10,
                visitDate: new Date(),
                patient,
                department,
            }),
        },
        $executeRaw: async (queryParts) => {
            assert.match(
                queryParts.join("?"),
                /pg_advisory_xact_lock\(\s*CAST\(\? AS INTEGER\),\s*CAST\(\? AS INTEGER\)\s*\)/s
            );
            return 1;
        },
        $queryRaw: async () => [{ nextToken: 2 }],
    };

    prisma.$transaction = async (callback) => callback(tx);

    try {
        const result = await registerVisitRecord({
            patientId: 7,
            departmentId: 2,
            opFee: 10,
            paymentMethod: "POS",
            authCode: "  AUTH-123  ",
        }, 3);

        assert.equal(result.visit.visitType, "REVISIT");
        assert.equal(result.visit.revisitCount, 2);
        assert.equal(result.visit.paymentAuthCode, "AUTH-123");
    } finally {
        prisma.$transaction = originalTransaction;
    }
});

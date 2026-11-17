const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildRegisteredPatientsQuery,
    patientRegistrationSchema,
    resolveAgeAndDateOfBirth,
} = require("./patientService");

test("registered patient queries scope ownership and combine every selected filter", () => {
    const query = buildRegisteredPatientsQuery("42", {
        q: "555",
        age: "32",
        gender: "FEMALE",
        departmentId: "7",
        fromDate: "2026-03-01",
        toDate: "2026-03-31",
        page: "2",
        limit: "10",
    });

    assert.deepEqual(query.where.AND[0], { createdBy: 42 });
    assert.deepEqual(query.where.AND[2], { gender: "FEMALE" });
    assert.deepEqual(query.where.AND[3], { age: 32 });
    assert.equal(query.skip, 10);
    assert.equal(query.page, 2);
    assert.equal(query.limit, 10);

    const searchConditions = query.where.AND[1].OR;
    assert(searchConditions.some((condition) => condition.firstName));
    assert(searchConditions.some((condition) => condition.phone));

    const matchingVisit = query.where.AND[4].OR[0].visits.some;
    assert.equal(matchingVisit.departmentId, 7);
    assert.deepEqual(matchingVisit.visitDate, {
        gte: new Date(2026, 2, 1),
        lt: new Date(2026, 3, 1),
    });
    assert.deepEqual(query.visitWhere, matchingVisit);
});

test("date-only filters match registration dates or historical visit dates", () => {
    const query = buildRegisteredPatientsQuery(42, {
        fromDate: "2026-03-01",
        toDate: "2026-03-31",
    });

    const dateMatches = query.where.AND[1].OR;
    assert.deepEqual(dateMatches[0].visits.some.visitDate, {
        gte: new Date(2026, 2, 1),
        lt: new Date(2026, 3, 1),
    });
    assert.deepEqual(dateMatches[1].createdAt, {
        gte: new Date(2026, 2, 1),
        lt: new Date(2026, 3, 1),
    });
});

test("registered patient filters reject invalid date ranges and values", () => {
    assert.throws(
        () => buildRegisteredPatientsQuery(42, {
            fromDate: "2026-04-01",
            toDate: "2026-03-31",
        }),
        { name: "ZodError" }
    );
    assert.throws(
        () => buildRegisteredPatientsQuery(42, { age: "151" }),
        { name: "ZodError" }
    );
    assert.throws(
        () => buildRegisteredPatientsQuery(0, {}),
        { code: "PATIENT_REGISTERED_VALIDATION_ERROR" }
    );
});

test("patient registration resolves either age or DOB and rejects mismatched values", () => {
    const currentYear = new Date().getFullYear();
    const fromAge = resolveAgeAndDateOfBirth("", 34);
    assert.equal(fromAge.age, 34);
    assert.equal(fromAge.dateOfBirth.getFullYear(), currentYear - 34);
    assert.equal(fromAge.dateOfBirth.getMonth(), 0);
    assert.equal(fromAge.dateOfBirth.getDate(), 1);

    const fromDob = resolveAgeAndDateOfBirth(`${currentYear - 34}-01-01`, undefined);
    assert.equal(fromDob.age, 34);

    assert.throws(
        () => resolveAgeAndDateOfBirth(`${currentYear - 34}-01-01`, 33),
        { code: "PATIENT_VALIDATION_ERROR" }
    );
    assert.throws(
        () => resolveAgeAndDateOfBirth(`${currentYear + 1}-01-01`, undefined),
        { code: "PATIENT_VALIDATION_ERROR" }
    );
});

test("patient registration accepts a full name without obsolete name fields", () => {
    assert.equal(patientRegistrationSchema.safeParse({
        firstName: "Jane Mary Doe",
        gender: "FEMALE",
        age: 31,
    }).success, true);

    assert.equal(patientRegistrationSchema.safeParse({
        firstName: "Jane Doe",
        middleName: "Mary",
        gender: "FEMALE",
        age: 31,
    }).success, false);
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getSchemeIneligibilityReason,
    getEligibleSchemes,
    resolveSchemeSelection,
    validateSchemeAdditionalInformation,
    validateSchemeConfiguration,
    validateSchemeEligibility,
} = require("./schemeEligibility");

function scheme(overrides = {}) {
    return {
        eligibilityGender: "ALL",
        ageCriteriaType: "ALL",
        ageLimit: null,
        minimumAge: null,
        maximumAge: null,
        collectAdditionalInformation: false,
        additionalInformationFields: [],
        ...overrides,
    };
}

test("validates gender eligibility and reports the exact rejection reason", () => {
    const femaleScheme = scheme({ eligibilityGender: "FEMALE" });
    assert.equal(getSchemeIneligibilityReason(femaleScheme, "FEMALE", 30), null);
    assert.equal(
        getSchemeIneligibilityReason(femaleScheme, "MALE", 30),
        "this scheme is for female patients only."
    );
    assert.throws(
        () => validateSchemeEligibility(femaleScheme, "MALE", 30),
        /this scheme is for female patients only/
    );
});

test("under and above age boundaries are exclusive", () => {
    const under18 = scheme({ ageCriteriaType: "UNDER", ageLimit: 18 });
    assert.equal(getSchemeIneligibilityReason(under18, "FEMALE", 17), null);
    assert.match(getSchemeIneligibilityReason(under18, "FEMALE", 18), /under 18 years old/);

    const above18 = scheme({ ageCriteriaType: "ABOVE", ageLimit: 18 });
    assert.match(getSchemeIneligibilityReason(above18, "MALE", 18), /above 18 years old/);
    assert.equal(getSchemeIneligibilityReason(above18, "MALE", 19), null);
});

test("custom age range includes both exact boundaries and rejects invalid ranges", () => {
    const range = scheme({
        ageCriteriaType: "RANGE",
        minimumAge: 18,
        maximumAge: 60,
    });
    assert.equal(getSchemeIneligibilityReason(range, "TRANSGENDER", 18), null);
    assert.equal(getSchemeIneligibilityReason(range, "TRANSGENDER", 60), null);
    assert.match(getSchemeIneligibilityReason(range, "TRANSGENDER", 17), /between 18 and 60/);
    assert.match(getSchemeIneligibilityReason(range, "TRANSGENDER", 61), /between 18 and 60/);
    assert.throws(
        () => validateSchemeConfiguration({ ...range, minimumAge: 61 }),
        /Minimum age cannot be greater/
    );
});

test("both age and gender explicitly configured require and validate both criteria", () => {
    const configured = scheme({
        eligibilityGender: "FEMALE",
        ageCriteriaType: "UNDER",
        ageLimit: 18,
    });
    assert.equal(getSchemeIneligibilityReason(configured, "FEMALE", 17), null);
    assert.match(getSchemeIneligibilityReason(configured, "MALE", 17), /female patients only/);
    assert.match(getSchemeIneligibilityReason(configured, "FEMALE", 18), /under 18 years old/);
    assert.match(getSchemeIneligibilityReason(configured, null, 17), /gender is required/);
    assert.match(getSchemeIneligibilityReason(configured, "FEMALE", null), /age is required/);
});

test("optional values preserve numeric-looking identifiers and empty values", () => {
    const config = scheme({
        collectAdditionalInformation: true,
        additionalInformationFields: [
            { key: "ration_card", label: "Ration Card Number" },
            { key: "army_id", label: "Army ID" },
        ],
    });
    assert.deepEqual(
        validateSchemeAdditionalInformation(config, [
            { key: "ration_card", value: "00001234" },
            { key: "army_id", value: "" },
        ]),
        [
            { key: "ration_card", label: "Ration Card Number", value: "00001234" },
            { key: "army_id", label: "Army ID", value: "" },
        ]
    );
    assert.throws(
        () => validateSchemeAdditionalInformation(config, [{ key: "other", value: "x" }]),
        /does not match the selected scheme/
    );
});

test("unrestricted age and gender criteria do not require patient demographics", () => {
    const unrestricted = scheme();
    const activeUnrestricted = { ...unrestricted, id: 1, status: "ACTIVE" };

    assert.equal(getSchemeIneligibilityReason(unrestricted, null, null), null);
    assert.deepEqual(getEligibleSchemes([activeUnrestricted], null, null), [activeUnrestricted]);
    assert.equal(
        resolveSchemeSelection([activeUnrestricted], null, null, 1, "VISIT_SCHEME_INELIGIBLE"),
        activeUnrestricted
    );
});

test("not applicable age and gender criteria do not require demographics or restrict eligibility", () => {
    const notApplicable = scheme({
        eligibilityGender: "NOT_APPLICABLE",
        ageCriteriaType: "NOT_APPLICABLE",
    });
    const activeNotApplicable = { ...notApplicable, id: 10, status: "ACTIVE" };

    assert.equal(getSchemeIneligibilityReason(notApplicable, null, null), null);
    assert.equal(getSchemeIneligibilityReason(notApplicable, "MALE", 45), null);
    assert.deepEqual(getEligibleSchemes([activeNotApplicable], null, null), [activeNotApplicable]);
    assert.equal(
        resolveSchemeSelection([activeNotApplicable], null, null, 10, "VISIT_SCHEME_INELIGIBLE"),
        activeNotApplicable
    );
});

test("age configured with gender not applicable only validates age", () => {
    const under18 = scheme({
        eligibilityGender: "NOT_APPLICABLE",
        ageCriteriaType: "UNDER",
        ageLimit: 18,
    });
    assert.equal(getSchemeIneligibilityReason(under18, null, 17), null);
    assert.equal(getSchemeIneligibilityReason(under18, "MALE", 17), null);
    assert.match(getSchemeIneligibilityReason(under18, "MALE", 18), /under 18 years old/);
    assert.match(getSchemeIneligibilityReason(under18, "MALE", null), /age is required/);
});

test("gender configured with age not applicable only validates gender", () => {
    const femaleOnly = scheme({
        eligibilityGender: "FEMALE",
        ageCriteriaType: "NOT_APPLICABLE",
    });
    assert.equal(getSchemeIneligibilityReason(femaleOnly, "FEMALE", null), null);
    assert.equal(getSchemeIneligibilityReason(femaleOnly, "FEMALE", 30), null);
    assert.match(getSchemeIneligibilityReason(femaleOnly, "MALE", 30), /female patients only/);
    assert.match(getSchemeIneligibilityReason(femaleOnly, null, 30), /gender is required/);
});

test("age boundaries must be empty when age is not applicable", () => {
    assert.throws(
        () => validateSchemeConfiguration(scheme({
            ageCriteriaType: "NOT_APPLICABLE",
            ageLimit: 10,
        })),
        /Age boundaries must be empty when age is not restricted/
    );
});

test("eligibility requires only the demographics used by configured criteria", () => {
    const under18 = scheme({ ageCriteriaType: "UNDER", ageLimit: 18 });
    assert.equal(getSchemeIneligibilityReason(under18, null, 17), null);
    assert.match(getSchemeIneligibilityReason(under18, null, null), /age is required/);

    const femaleOnly = scheme({ eligibilityGender: "FEMALE" });
    assert.equal(getSchemeIneligibilityReason(femaleOnly, "FEMALE", null), null);
    assert.match(getSchemeIneligibilityReason(femaleOnly, null, null), /gender is required/);

    const femaleUnder18 = scheme({
        eligibilityGender: "FEMALE",
        ageCriteriaType: "UNDER",
        ageLimit: 18,
    });
    assert.equal(getSchemeIneligibilityReason(femaleUnder18, "FEMALE", 17), null);
    assert.match(getSchemeIneligibilityReason(femaleUnder18, "MALE", 17), /female patients only/);
    assert.match(getSchemeIneligibilityReason(femaleUnder18, "FEMALE", null), /age is required/);
    assert.match(getSchemeIneligibilityReason(under18, "FEMALE", null), /age is required/);
});

test("scheme selection is optional, while explicitly selected schemes must be eligible", () => {
    const activeUnder18 = {
        ...scheme({ eligibilityGender: "FEMALE", ageCriteriaType: "UNDER", ageLimit: 18 }),
        id: 1,
        status: "ACTIVE",
    };
    const inactiveUnder18 = {
        ...scheme({ ageCriteriaType: "UNDER", ageLimit: 18 }),
        id: 2,
        status: "INACTIVE",
    };
    const activeFemale = {
        ...scheme({ eligibilityGender: "FEMALE" }),
        id: 3,
        status: "ACTIVE",
    };

    assert.deepEqual(getEligibleSchemes([activeUnder18, inactiveUnder18, activeFemale], "FEMALE", 17), [
        activeUnder18,
        activeFemale,
    ]);
    assert.equal(resolveSchemeSelection([activeUnder18], "FEMALE", 17, undefined, "VISIT_SCHEME_INELIGIBLE"), null);
    assert.equal(resolveSchemeSelection([activeUnder18, activeFemale], "FEMALE", 17, null, "VISIT_SCHEME_INELIGIBLE"), null);
    assert.equal(resolveSchemeSelection([activeUnder18, activeFemale], "FEMALE", 17, 3, "VISIT_SCHEME_INELIGIBLE"), activeFemale);
    assert.throws(
        () => resolveSchemeSelection([activeUnder18], "FEMALE", 18, 1, "VISIT_SCHEME_INELIGIBLE"),
        { code: "VISIT_SCHEME_INELIGIBLE" }
    );
    assert.throws(
        () => resolveSchemeSelection([inactiveUnder18], "FEMALE", 17, 2, "VISIT_SCHEME_INELIGIBLE"),
        { code: "VISIT_SCHEME_INELIGIBLE" }
    );
    assert.deepEqual(getEligibleSchemes([inactiveUnder18], "FEMALE", 17), []);
    assert.equal(resolveSchemeSelection([], "FEMALE", 17, undefined, "VISIT_SCHEME_INELIGIBLE"), null);
});

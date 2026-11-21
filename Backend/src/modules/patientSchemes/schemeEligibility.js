const { z } = require("zod");

const additionalInformationFieldSchema = z.object({
    key: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
    label: z.string().trim().min(1, "Additional information field labels are required").max(100),
}).strict();

const schemeAdditionalInformationSchema = z.array(z.object({
    key: z.string().trim().min(1).max(100),
    value: z.string().max(500),
    label: z.string().max(100).optional(),
}).strict()).max(50);

function validationError(message, code = "SCHEME_VALIDATION_ERROR") {
    const error = new Error(message);
    error.code = code;
    return error;
}

function validateSchemeConfiguration(scheme) {
    const gender = scheme.eligibilityGender ?? "ALL";
    const ageType = scheme.ageCriteriaType ?? "ALL";
    const ageLimit = scheme.ageLimit ?? null;
    const minimumAge = scheme.minimumAge ?? null;
    const maximumAge = scheme.maximumAge ?? null;
    const fields = scheme.additionalInformationFields ?? [];

    if (!["ALL", "NOT_APPLICABLE", "FEMALE", "MALE", "TRANSGENDER"].includes(gender)) {
        throw validationError("Eligibility gender is invalid");
    }
    if (!["ALL", "NOT_APPLICABLE", "UNDER", "ABOVE", "RANGE"].includes(ageType)) {
        throw validationError("Age criteria is invalid");
    }
    if (!Array.isArray(fields)) {
        throw validationError("Additional information fields must be a list");
    }

    const parsedFields = z.array(additionalInformationFieldSchema).max(50).safeParse(fields);
    if (!parsedFields.success) {
        throw validationError(parsedFields.error.issues.map((issue) => issue.message).join(", "));
    }
    const keys = new Set();
    for (const field of parsedFields.data) {
        if (keys.has(field.key)) {
            throw validationError("Additional information field keys must be unique");
        }
        keys.add(field.key);
    }

    const validateAge = (value) => Number.isInteger(value) && value >= 0 && value <= 150;
    if (ageType === "UNDER" || ageType === "ABOVE") {
        if (!validateAge(ageLimit)) {
            throw validationError("Age limit must be a whole number between 0 and 150");
        }
        if (minimumAge !== null || maximumAge !== null) {
            throw validationError("Minimum and maximum ages are only used for custom age ranges");
        }
    } else if (ageType === "RANGE") {
        if (!validateAge(minimumAge) || !validateAge(maximumAge)) {
            throw validationError("Minimum and maximum ages must be whole numbers between 0 and 150");
        }
        if (minimumAge > maximumAge) {
            throw validationError("Minimum age cannot be greater than maximum age");
        }
        if (ageLimit !== null) {
            throw validationError("Age limit is not used for custom age ranges");
        }
    } else if (ageLimit !== null || minimumAge !== null || maximumAge !== null) {
        throw validationError("Age boundaries must be empty when age is not restricted");
    }

    if (scheme.collectAdditionalInformation && parsedFields.data.length === 0) {
        throw validationError("Add at least one additional information field or disable collection");
    }

    return {
        eligibilityGender: gender,
        ageCriteriaType: ageType,
        ageLimit,
        minimumAge,
        maximumAge,
        collectAdditionalInformation: Boolean(scheme.collectAdditionalInformation),
        additionalInformationFields: parsedFields.data,
    };
}

function calculateAge(dateOfBirth, fallbackAge) {
    if (!dateOfBirth) {
        return fallbackAge;
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
        return fallbackAge;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (
        today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
        age -= 1;
    }
    return age;
}

function getSchemeIneligibilityReason(scheme, gender, age) {
    const config = validateSchemeConfiguration(scheme);
    const hasGenderRestriction = !["ALL", "NOT_APPLICABLE"].includes(config.eligibilityGender);
    const hasAgeRestriction = !["ALL", "NOT_APPLICABLE"].includes(config.ageCriteriaType);

    if (hasGenderRestriction && !["FEMALE", "MALE", "TRANSGENDER"].includes(gender)) {
        return "the patient's gender is required to verify eligibility.";
    }
    if (hasAgeRestriction && (!Number.isInteger(age) || age < 0 || age > 150)) {
        return "the patient's age is required to verify eligibility.";
    }

    if (hasGenderRestriction && config.eligibilityGender !== gender) {
        const genderLabel = {
            FEMALE: "female",
            MALE: "male",
            TRANSGENDER: "transgender",
        }[config.eligibilityGender];
        return `this scheme is for ${genderLabel} patients only.`;
    }

    if (config.ageCriteriaType === "UNDER" && age >= config.ageLimit) {
        return `the patient must be under ${config.ageLimit} years old.`;
    }
    if (config.ageCriteriaType === "ABOVE" && age <= config.ageLimit) {
        return `the patient must be above ${config.ageLimit} years old.`;
    }
    if (
        config.ageCriteriaType === "RANGE" &&
        (age < config.minimumAge || age > config.maximumAge)
    ) {
        return `the patient must be between ${config.minimumAge} and ${config.maximumAge} years old.`;
    }
    return null;
}

function validateSchemeEligibility(scheme, gender, age, errorCode = "PATIENT_VALIDATION_ERROR") {
    const reason = getSchemeIneligibilityReason(scheme, gender, age);
    if (reason) {
        throw validationError(`This scheme is not eligible for this patient: ${reason}`, errorCode);
    }
}

function getEligibleSchemes(schemes, gender, age) {
    return schemes.filter((scheme) =>
        scheme.status === "ACTIVE" &&
        getSchemeIneligibilityReason(scheme, gender, age) === null
    );
}

function resolveSchemeSelection(schemes, gender, age, requestedSchemeId, errorCode) {
    const eligibleSchemes = getEligibleSchemes(schemes, gender, age);

    if (requestedSchemeId !== undefined && requestedSchemeId !== null) {
        const selectedScheme = schemes.find((scheme) => scheme.id === requestedSchemeId);
        if (!selectedScheme || selectedScheme.status !== "ACTIVE") {
            throw validationError("Selected scheme does not exist or is inactive", errorCode);
        }
        validateSchemeEligibility(selectedScheme, gender, age, errorCode);
        return selectedScheme;
    }

    if (eligibleSchemes.length > 1) {
        throw validationError(
            "Multiple schemes match this patient. Select an eligible scheme to continue.",
            "VISIT_SCHEME_SELECTION_REQUIRED"
        );
    }

    return eligibleSchemes[0] ?? null;
}

function validateSchemeAdditionalInformation(scheme, values) {
    const config = validateSchemeConfiguration(scheme);
    const parsedValues = schemeAdditionalInformationSchema.safeParse(values ?? []);
    if (!parsedValues.success) {
        throw validationError(
            parsedValues.error.issues.map((issue) => issue.message).join(", "),
            "SCHEME_FIELD_VALIDATION_ERROR"
        );
    }

    const configuredFields = config.collectAdditionalInformation
        ? config.additionalInformationFields
        : [];
    const fieldByKey = new Map(configuredFields.map((field) => [field.key, field]));
    const valuesByKey = new Map();

    for (const value of parsedValues.data) {
        const field = fieldByKey.get(value.key);
        if (!field) {
            throw validationError(
                "Submitted additional information does not match the selected scheme",
                "SCHEME_FIELD_VALIDATION_ERROR"
            );
        }
        if (valuesByKey.has(value.key)) {
            throw validationError(
                "Additional information fields cannot be submitted more than once",
                "SCHEME_FIELD_VALIDATION_ERROR"
            );
        }
        valuesByKey.set(value.key, value.value);
    }

    return configuredFields.map((field) => ({
        key: field.key,
        label: field.label,
        value: valuesByKey.get(field.key) ?? "",
    }));
}

function getSchemeEligibilitySnapshot(scheme) {
    const config = validateSchemeConfiguration(scheme);
    return {
        eligibilityGender: config.eligibilityGender,
        ageCriteriaType: config.ageCriteriaType,
        ageLimit: config.ageLimit,
        minimumAge: config.minimumAge,
        maximumAge: config.maximumAge,
        collectAdditionalInformation: config.collectAdditionalInformation,
        additionalInformationFields: config.additionalInformationFields,
    };
}

module.exports = {
    calculateAge,
    getEligibleSchemes,
    resolveSchemeSelection,
    getSchemeEligibilitySnapshot,
    getSchemeIneligibilityReason,
    validateSchemeAdditionalInformation,
    validateSchemeConfiguration,
    validateSchemeEligibility,
};

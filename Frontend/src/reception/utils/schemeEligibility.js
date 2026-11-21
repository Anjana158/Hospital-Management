export function getPatientAge(patient) {
    if (patient?.dateOfBirth) {
        const dateOfBirth = new Date(patient.dateOfBirth);
        if (!Number.isNaN(dateOfBirth.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - dateOfBirth.getFullYear();
            if (
                today.getMonth() < dateOfBirth.getMonth() ||
                (today.getMonth() === dateOfBirth.getMonth() &&
                    today.getDate() < dateOfBirth.getDate())
            ) {
                age -= 1;
            }
            return age;
        }
    }
    return Number(patient?.age);
}

export function getSchemeEligibility(scheme, gender, age) {
    if (!scheme) {
        return { eligible: true, message: "" };
    }

    const eligibilityGender = scheme.eligibilityGender || "ALL";
    const ageCriteriaType = scheme.ageCriteriaType || "ALL";
    const hasGenderRestriction = !["ALL", "NOT_APPLICABLE"].includes(eligibilityGender);
    const hasAgeRestriction = !["ALL", "NOT_APPLICABLE"].includes(ageCriteriaType);
    const validGenders = ["FEMALE", "MALE", "TRANSGENDER"];
    const numericAge = Number(age);

    if (hasGenderRestriction && !validGenders.includes(gender)) {
        return {
            eligible: false,
            pending: true,
            message: "Enter the patient's gender to validate this scheme.",
        };
    }
    if (hasAgeRestriction && (
        age === "" ||
        age === null ||
        age === undefined ||
        !Number.isInteger(numericAge) ||
        numericAge < 0 ||
        numericAge > 150
    )) {
        return {
            eligible: false,
            pending: true,
            message: "Enter the patient's age to validate this scheme.",
        };
    }

    if (hasGenderRestriction && eligibilityGender !== gender) {
        const label = {
            FEMALE: "female",
            MALE: "male",
            TRANSGENDER: "transgender",
        }[eligibilityGender];
        return {
            eligible: false,
            message: `This scheme is not eligible for this patient: this scheme is for ${label} patients only.`,
        };
    }

    if (ageCriteriaType === "UNDER" && numericAge >= scheme.ageLimit) {
        return {
            eligible: false,
            message: `This scheme is not eligible for this patient: the patient must be under ${scheme.ageLimit} years old.`,
        };
    }
    if (ageCriteriaType === "ABOVE" && numericAge <= scheme.ageLimit) {
        return {
            eligible: false,
            message: `This scheme is not eligible for this patient: the patient must be above ${scheme.ageLimit} years old.`,
        };
    }
    if (
        ageCriteriaType === "RANGE" &&
        (numericAge < scheme.minimumAge || numericAge > scheme.maximumAge)
    ) {
        return {
            eligible: false,
            message: `This scheme is not eligible for this patient: the patient must be between ${scheme.minimumAge} and ${scheme.maximumAge} years old.`,
        };
    }

    return {
        eligible: true,
        message: "This patient satisfies the scheme's eligibility criteria.",
    };
}

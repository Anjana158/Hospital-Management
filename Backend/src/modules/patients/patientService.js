const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");
const { buildPatientSearchFilter } = require("./patientSearch");
const {
    calculateAge,
    validateSchemeAdditionalInformation,
    validateSchemeEligibility,
} = require("../patientSchemes/schemeEligibility");

const patientSearchSchema = z.object({q: z.string().trim().min(2, "Search query must contain at least 2 characters").max(100),
    field: z.enum(["all", "uhid", "name", "phone"]).default("all"),
    gender: z.enum(["ALL", "MALE", "FEMALE", "TRANSGENDER"]).default("ALL"),
    ageGroup: z.enum(["ALL", "0-13", "13-18", "above-18"]).default("ALL"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const phoneSchema = z.string().trim().min(1).max(30, "Phone number is too long")
    .refine((value) => /^\d{10}$/.test(value), {
        message: "Phone number must contain exactly 10 digits and no special characters",
    });

const optionalPhoneSchema = z.union([
    z.literal(""),
    phoneSchema,
]).optional();

/*
|--------------------------------------------------------------------------
| Patient Registration Validation
|--------------------------------------------------------------------------
|
| DOB OR age is required.
|
| If DOB is provided:
|   -> backend calculates age from DOB.
|
| If age is provided:
|   -> backend generates DOB as January 1 of the calculated birth year.
|
| If both are provided:
|   -> backend checks that they match.
|
*/
const patientRegistrationSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    middleName: z.string().trim().max(100).optional().or(z.literal("")),
    lastName: z.string().trim().max(100).optional().or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    age: z.coerce.number().int("Age must be a whole number").min(0, "Age cannot be negative").max(150, "Age cannot exceed 150").optional(),
    gender: z.enum(["MALE", "FEMALE", "TRANSGENDER"],{
            message: "Gender is required",
        }
    ),
    phone: optionalPhoneSchema,
    alternatePhone: phoneSchema.optional().or(z.literal("")),
    email: z.string().trim().email("Email must be valid").max(255).optional().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    district: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(100).optional().or(z.literal("")),

    // Scheme is OPTIONAL
    schemeId: z.coerce.number().int().positive().optional(),
    schemeAdditionalInformation: z.array(z.object({
        key: z.string().trim().min(1).max(100),
        value: z.string().max(500),
    }).strict()).max(50).optional(),
}).strict();


/*
|--------------------------------------------------------------------------
| Patient Update Validation
|--------------------------------------------------------------------------
*/

const patientUpdateSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100).optional(),
    middleName: z.string().trim().max(100).optional().or(z.literal("")),
    lastName: z.string().trim().max(100).optional().or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    age: z.coerce.number().int("Age must be a whole number").min(0, "Age cannot be negative").max(150, "Age cannot exceed 150").optional(),
    gender: z.enum(["MALE", "FEMALE", "TRANSGENDER"]).optional(),
    phone: optionalPhoneSchema,
    alternatePhone: phoneSchema.optional().or(z.literal("")),
    email: z.string().trim().email("Email must be valid").max(255).optional().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    district: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(100).optional().or(z.literal("")),

    // Optional scheme.
    // Empty string means remove scheme.
    schemeId: z.union([
            z.coerce.number().int().positive(),
            z.literal(""),
        ]).optional(),
    schemeAdditionalInformation: z.array(z.object({
        key: z.string().trim().min(1).max(100),
        value: z.string().max(500),
    }).strict()).max(50).optional(),
}).strict();


/*
|--------------------------------------------------------------------------
| Date of Birth Helpers
|--------------------------------------------------------------------------
*/

function parseDateOfBirth(value, errorCode = "PATIENT_UPDATE_VALIDATION_ERROR") {
    if (!value) {
        return undefined;
    }
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime()) || date > new Date()) {
        const error = new Error(
            "Date of birth must be a valid past date"
        );
        error.code = errorCode;
        throw error;
    }
    return date;
}

/*
|--------------------------------------------------------------------------
| Create Approximate DOB from Age
|--------------------------------------------------------------------------
*/

function createApproximateDateOfBirth(age) {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear - age,0,1);
}

/*
|--------------------------------------------------------------------------
| Resolve DOB + Age
|--------------------------------------------------------------------------
*/

function resolveAgeAndDateOfBirth(dateOfBirthValue,ageValue,errorCode = "PATIENT_VALIDATION_ERROR") {
    const hasDob = Boolean(dateOfBirthValue);

    const hasAge = ageValue !== undefined && ageValue !== null && ageValue !== "";

    if (!hasDob && !hasAge) {
        const error = new Error("Date of birth or age is required");
        error.code = errorCode;
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | DOB provided
    |--------------------------------------------------------------------------
    */

    if (hasDob) {
        const dateOfBirth = parseDateOfBirth(dateOfBirthValue,errorCode);
        const calculatedAge = calculateAge(dateOfBirth);

        if (calculatedAge < 0 || calculatedAge > 150) {
            const error = new Error("Date of birth results in an invalid age");
            error.code = errorCode;
            throw error;
        }

        /*
        | If age was also supplied, make sure it matches.
        */
        if (hasAge && Number(ageValue) !== calculatedAge) {
            const error = new Error(`Age does not match date of birth. Expected age: ${calculatedAge}`);
            error.code = errorCode;
            throw error;
        }

        return {dateOfBirth, age: calculatedAge, };
    }

    /*
    |--------------------------------------------------------------------------
    | Age only
    |--------------------------------------------------------------------------
    */

    const age = Number(ageValue);

    if ( !Number.isInteger(age) || age < 0 || age > 150 ) {
        const error = new Error("Age must be a whole number between 0 and 150" );
        error.code = errorCode;
        throw error;
    }
    const dateOfBirth = createApproximateDateOfBirth(age);
    return {dateOfBirth,age,};
}

/*
|--------------------------------------------------------------------------
| Generate UHID
|--------------------------------------------------------------------------
*/

function generateUhid() {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const randomPart = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `UHID-${datePart}-${randomPart}`;
}

/*
|--------------------------------------------------------------------------
| Normalize Phone
|--------------------------------------------------------------------------
*/

function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "");
}

function normalizeOptionalPhone(phone) {
    const normalized = normalizePhone(phone);
    return normalized ? normalized : null;
}

/*
|--------------------------------------------------------------------------
| Patient Summary Select
|--------------------------------------------------------------------------
*/

const patientSummarySelect = {
    id: true,
    uhid: true,

    firstName: true,
    middleName: true,
    lastName: true,

    dateOfBirth: true,
    age: true,
    gender: true,

    phone: true,
    alternatePhone: true,

    status: true,

    scheme: {
        select: {
            id: true,
            code: true,
            name: true,
            eligibilityGender: true,
            ageCriteriaType: true,
            ageLimit: true,
            minimumAge: true,
            maximumAge: true,
            collectAdditionalInformation: true,
            additionalInformationFields: true,
            status: true,
        },
    },

    updatedAt: true,
};

/*
|--------------------------------------------------------------------------
| Patient Details Select
|--------------------------------------------------------------------------
*/

const patientDetailsSelect = {
    id: true,
    uhid: true,

    firstName: true,
    middleName: true,
    lastName: true,

    dateOfBirth: true,
    age: true,
    gender: true,

    phone: true,
    alternatePhone: true,
    email: true,

    addressLine1: true,
    addressLine2: true,
    city: true,
    district: true,
    state: true,
    postalCode: true,
    country: true,

    status: true,
    archivedAt: true,
    schemeAdditionalInformation: true,

    scheme: {
        select: {
            id: true,
            code: true,
            name: true,
            eligibilityGender: true,
            ageCriteriaType: true,
            ageLimit: true,
            minimumAge: true,
            maximumAge: true,
            collectAdditionalInformation: true,
            additionalInformationFields: true,
            status: true,
        },
    },

    createdAt: true,
    updatedAt: true,
};


/*
|--------------------------------------------------------------------------
| Get Patient Details
|--------------------------------------------------------------------------
*/

async function getPatientDetails(identifier, lookupType) {
    let patient;

    if (lookupType === "id") {
        const patientId = Number(identifier);

        if (!Number.isInteger(patientId) || patientId < 1 ) {
            const error = new Error("Patient ID must be a positive integer" );
            error.code = "PATIENT_DETAILS_VALIDATION_ERROR";
            throw error;
        }

        patient = await prisma.patient.findUnique({
            where: {
                id: patientId,
            },

            select: patientDetailsSelect,
        });
    } else {
        const uhid = String(identifier).trim();

        if (!uhid) {
            const error = new Error("UHID is required");
            error.code = "PATIENT_DETAILS_VALIDATION_ERROR";
            throw error;
        }

        patient = await prisma.patient.findFirst({
            where: {
                uhid: {
                    equals: uhid,
                    mode: "insensitive",
                },
            },

            select: patientDetailsSelect,
        });
    }

    if (!patient) {
        const error = new Error("Patient not found");
        error.code = "PATIENT_NOT_FOUND";
        throw error;
    }

    return patient;
}


/*
|--------------------------------------------------------------------------
| Search Patients
|--------------------------------------------------------------------------
*/

async function searchPatients(query) {
    const validatedQuery = patientSearchSchema.parse(query);

    const filters = [buildPatientSearchFilter(validatedQuery.q, validatedQuery.field)];

    if (validatedQuery.gender !== "ALL") {
        filters.push({ gender: validatedQuery.gender });
    }

    if (validatedQuery.ageGroup === "0-13") {
        filters.push({ age: { lte: 13 } });
    } else if (validatedQuery.ageGroup === "13-18") {
        filters.push({ age: { gt: 13, lte: 18 } });
    } else if (validatedQuery.ageGroup === "above-18") {
        filters.push({ age: { gt: 18 } });
    }

    const where = { AND: filters };
    const skip = (validatedQuery.page - 1) * validatedQuery.limit;

    const [items, total] = await prisma.$transaction([
            prisma.patient.findMany({
                where,
                select: patientSummarySelect,
                orderBy: {
                    updatedAt: "desc",
                },
                skip,
                take: validatedQuery.limit,
            }),

            prisma.patient.count({where,}),
        ]);

    const totalPages = Math.ceil(total / validatedQuery.limit);

    return {items,
        pagination: {
            page: validatedQuery.page,
            limit: validatedQuery.limit,
            total,
            totalPages,
            hasPreviousPage: validatedQuery.page > 1,
            hasNextPage:
                validatedQuery.page <
                totalPages,
        },
    };
}


/*
|--------------------------------------------------------------------------
| Get Today's Registered Patients
|--------------------------------------------------------------------------
*/

async function getTodayPatients(page = 1, limit = 20) {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        const error = new Error("Page must be a positive integer");
        error.code = "PATIENT_TODAY_VALIDATION_ERROR";
        throw error;
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50 ) {
        const error = new Error("Limit must be between 1 and 50");
        error.code ="PATIENT_TODAY_VALIDATION_ERROR";
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Today's date boundaries
    |--------------------------------------------------------------------------
    */

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0);
    const startOfTomorrow = new Date(now.getFullYear(),now.getMonth(),now.getDate() + 1,0,0,0,0);
    const where = {
        createdAt: {
            gte: startOfToday,
            lt: startOfTomorrow,
        },
    };

    const skip = (parsedPage - 1) * parsedLimit;

    const [items, total] = await prisma.$transaction([
            prisma.patient.findMany({
                where,
                select: patientSummarySelect,
                orderBy: { createdAt: "desc",},
                skip,
                take: parsedLimit,
            }),
            prisma.patient.count({where,}),
        ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return {
        items,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages,
            hasNextPage:
                parsedPage < totalPages,
            hasPreviousPage:
                parsedPage > 1,
        },
    };
}

/*
|--------------------------------------------------------------------------
| Register Patient
|--------------------------------------------------------------------------
*/

async function registerPatientRecord(data,createdBy) {
    const validatedData = patientRegistrationSchema.parse(data);

    /*
    |--------------------------------------------------------------------------
    | Resolve DOB + Age
    |--------------------------------------------------------------------------
    */

    const {dateOfBirth,age,} = resolveAgeAndDateOfBirth(
        validatedData.dateOfBirth,
        validatedData.age,
        "PATIENT_VALIDATION_ERROR"
    );

    /*
    |--------------------------------------------------------------------------
    | Validate Scheme
    |--------------------------------------------------------------------------
    */

    let schemeId = null;
    let scheme = null;

    if (validatedData.schemeId !== undefined && validatedData.schemeId !== null) {
        scheme = await prisma.patientScheme.findFirst({
                where: {
                    id: Number(
                        validatedData.schemeId
                    ),
                    status: "ACTIVE",
                },

                select: {
                    id: true,
                    eligibilityGender: true,
                    ageCriteriaType: true,
                    ageLimit: true,
                    minimumAge: true,
                    maximumAge: true,
                    collectAdditionalInformation: true,
                    additionalInformationFields: true,
                },
            });

        if (!scheme) {
            const error = new Error("Selected scheme does not exist or is inactive");
            error.code ="PATIENT_VALIDATION_ERROR";
            throw error;
        }
        validateSchemeEligibility(scheme, validatedData.gender, calculateAge(dateOfBirth, age));
        schemeId = scheme.id;
    }
    const schemeAdditionalInformation = scheme
        ? validateSchemeAdditionalInformation(scheme, validatedData.schemeAdditionalInformation)
        : [];
    if (!scheme && validatedData.schemeAdditionalInformation?.length) {
        const error = new Error("Additional information cannot be submitted without a scheme");
        error.code = "SCHEME_FIELD_VALIDATION_ERROR";
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Normalize Phone
    |--------------------------------------------------------------------------
    */

    const normalizedPhone = normalizeOptionalPhone(validatedData.phone);

    const normalizedAlternatePhone = validatedData.alternatePhone
            ? normalizePhone(
                validatedData.alternatePhone
            )
            : null;

    /*
    |--------------------------------------------------------------------------
    | Primary and Alternate Phone Cannot Be Same
    |--------------------------------------------------------------------------
    */

    if (normalizedAlternatePhone && normalizedPhone === normalizedAlternatePhone) {
        const error = new Error("Primary and alternate phone numbers cannot be the same");
        error.code ="PATIENT_VALIDATION_ERROR";
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Check Possible Duplicate Patients
    |--------------------------------------------------------------------------
    */

    const duplicatePhoneFilters = [];

    if (normalizedPhone) {
        duplicatePhoneFilters.push(
            { phone: normalizedPhone },
            { alternatePhone: normalizedPhone }
        );
    }

    if (normalizedAlternatePhone) {
        duplicatePhoneFilters.push(
            { phone: normalizedAlternatePhone },
            { alternatePhone: normalizedAlternatePhone }
        );
    }

    const possibleDuplicates = duplicatePhoneFilters.length === 0
        ? []
        : await prisma.patient.findMany({
            where: {
                OR: duplicatePhoneFilters,
            },

            select: {
                id: true,
                uhid: true,

                firstName: true,
                middleName: true,
                lastName: true,

                dateOfBirth: true,
                age: true,
                gender: true,

                phone: true,
                alternatePhone: true,
                scheme: {
                    select: { id: true, code: true, name: true, status: true },
                },

                status: true,
                archivedAt: true,
            },

            orderBy: {
                createdAt: "desc",
            },

            take: 10,
        });

    if (possibleDuplicates.length > 0) {
        const error = new Error("A patient with this phone number may already exist");
        error.code ="PATIENT_DUPLICATE_PHONE";
        error.duplicates = possibleDuplicates;
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Prepare Patient Data
    |--------------------------------------------------------------------------
    */

    const patientData = {
        firstName: validatedData.firstName,
        middleName: validatedData.middleName || undefined,
        lastName:  validatedData.lastName || undefined,
        dateOfBirth,
        age,
        gender:validatedData.gender,
        phone:normalizedPhone,
        alternatePhone:normalizedAlternatePhone,
        email:validatedData.email || undefined,
        addressLine1:validatedData.addressLine1 || undefined,
        addressLine2:validatedData.addressLine2 || undefined,
        city:validatedData.city || undefined,
        district:validatedData.district || undefined,
        state:validatedData.state || undefined,
        postalCode:validatedData.postalCode || undefined,
        country:validatedData.country || undefined,
    };
    
    /*
    |--------------------------------------------------------------------------
    | Create Patient
    |--------------------------------------------------------------------------
    */

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await prisma.patient.create({
                data: {
                    ...patientData,
                    uhid: generateUhid(),
                    scheme: schemeId ? {
                        connect: {
                            id: schemeId,
                        },
                    } : undefined,
                    schemeAdditionalInformation,

                    createdByUser: {
                        connect: {
                            id: Number(createdBy),
                        },
                    },
                },

                select: {
                    id: true,
                    uhid: true,

                    firstName: true,
                    middleName: true,
                    lastName: true,

                    dateOfBirth: true,
                    age: true,
                    gender: true,

                    phone: true,
                    alternatePhone: true,
                    email: true,

                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    district: true,
                    state: true,
                    postalCode: true,
                    country: true,

                    scheme: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            eligibilityGender: true,
                            ageCriteriaType: true,
                            ageLimit: true,
                            minimumAge: true,
                            maximumAge: true,
                            collectAdditionalInformation: true,
                            additionalInformationFields: true,
                            status: true,
                        },
                    },
                    schemeAdditionalInformation: true,

                    createdBy: true,
                    createdAt: true,
                },
            });
        } catch (error) {
            if (error.code !== "P2002" || attempt === 2) {
                throw error;
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| Update Patient
|--------------------------------------------------------------------------
*/

async function updatePatientRecord(patientId,data) {
    const patientIdNum = Number(patientId);
    if (!Number.isInteger(patientIdNum) || patientIdNum < 1) {
        const error = new Error("Patient ID must be a positive integer");
        error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    const validatedData = patientUpdateSchema.parse(data);
    const editableFields =
        Object.keys(validatedData).filter(
            (key) =>
                validatedData[key] !== undefined
        );

    if (editableFields.length === 0) {
        const error = new Error("At least one editable field must be provided");
        error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Get Existing Patient
    |--------------------------------------------------------------------------
    */

    const existingPatient = await prisma.patient.findUnique({
            where: {
                id: patientIdNum,
            },

            select: {
                id: true,

                dateOfBirth: true,
                age: true,
                gender: true,

                phone: true,
                alternatePhone: true,

                schemeId: true,
                schemeAdditionalInformation: true,
            },
        });

    if (!existingPatient) {
        const error = new Error("Patient not found");
        error.code ="PATIENT_NOT_FOUND";
        throw error;
    }

    const updateData = {};

    if (validatedData.firstName !== undefined) {
        updateData.firstName = validatedData.firstName;
    }

    if (validatedData.gender !== undefined) {
        updateData.gender = validatedData.gender;
    }

    /*
    |--------------------------------------------------------------------------
    | Optional String Fields
    |--------------------------------------------------------------------------
    */

    const optionalStringFields = [
        "middleName",
        "lastName",
        "email",
        "addressLine1",
        "addressLine2",
        "city",
        "district",
        "state",
        "postalCode",
        "country",
    ];

    optionalStringFields.forEach(
        (field) => {
            if (validatedData[field] !== undefined ) {
                updateData[field] =
                    validatedData[field] ||
                    null;
            }
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Resolve DOB + Age During Update
    |--------------------------------------------------------------------------
    */

    const dobWasProvided = validatedData.dateOfBirth !== undefined;
    const ageWasProvided = validatedData.age !== undefined;

    if (dobWasProvided || ageWasProvided) {
        let finalDateOfBirth;
        let finalAge;

        /*
        | Both fields sent
        */

        if ( validatedData.dateOfBirth && ageWasProvided ) {
            const resolved =
                resolveAgeAndDateOfBirth(
                    validatedData.dateOfBirth,
                    validatedData.age,
                    "PATIENT_UPDATE_VALIDATION_ERROR"
                );

            finalDateOfBirth = resolved.dateOfBirth;
            finalAge = resolved.age;
        }

        /*
        | DOB changed only
        */

        else if (validatedData.dateOfBirth) {
            const dateOfBirth = parseDateOfBirth(validatedData.dateOfBirth);
            finalDateOfBirth = dateOfBirth;
            finalAge =calculateAge(dateOfBirth);
        }

        /*
        | Age changed only
        */

        else if (ageWasProvided) {
            finalAge =Number(validatedData.age);
            if (!Number.isInteger(finalAge) || finalAge < 0 || finalAge > 150) {
                const error = new Error("Age must be a whole number between 0 and 150");
                error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
                throw error;
            }
            finalDateOfBirth = createApproximateDateOfBirth(finalAge);
        }

        /*
        | Empty DOB sent without age
        */

        else {
            const error = new Error("Date of birth or age is required");
            error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
            throw error;
        }
        updateData.dateOfBirth =finalDateOfBirth;
        updateData.age =finalAge;
    }

    /*
    |--------------------------------------------------------------------------
    | Phone Handling
    |--------------------------------------------------------------------------
    */

    let newPhone =existingPatient.phone;
    let newAltPhone =existingPatient.alternatePhone;

    if (validatedData.phone !== undefined) {
        newPhone = normalizeOptionalPhone(validatedData.phone);
        updateData.phone = newPhone;
    }

    if (validatedData.alternatePhone !== undefined) {
        if (validatedData.alternatePhone === "") {
            newAltPhone = null;
        } else {
            newAltPhone =
                normalizePhone(
                    validatedData.alternatePhone
                );
        }
        updateData.alternatePhone = newAltPhone;
    }

    /*
    |--------------------------------------------------------------------------
    | Primary / Alternate Phone Same Check
    |--------------------------------------------------------------------------
    */

    if (newPhone && newAltPhone && newPhone === newAltPhone) {
        const error = new Error("Primary and alternate phone numbers cannot be the same");
        error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Duplicate Phone Check
    |--------------------------------------------------------------------------
    */

    if (validatedData.phone !== undefined || validatedData.alternatePhone !== undefined) {
        const phonesToCheck = [];
        if (newPhone) {
            phonesToCheck.push(
                newPhone
            );
        }
        if (newAltPhone) {
            phonesToCheck.push(
                newAltPhone
            );
        }

        if (phonesToCheck.length > 0) {
            const duplicates = await prisma.patient.findMany({
                    where: {
                        id: {
                            not: patientIdNum,
                        },

                        OR: [
                            {
                                phone: {
                                    in: phonesToCheck,
                                },
                            },
                            {
                                alternatePhone: {
                                    in: phonesToCheck,
                                },
                            },
                        ],
                    },

                    select: {
                        id: true,
                        uhid: true,

                        firstName: true,
                        lastName: true,

                        phone: true,
                        alternatePhone: true,

                        status: true,
                    },

                    take: 10,
                });

            if (
                duplicates.length > 0
            ) {
                const error = new Error("A patient with this phone number may already exist");
                error.code ="PATIENT_DUPLICATE_PHONE";
                error.duplicates =duplicates;
                throw error;
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Scheme Handling
    |--------------------------------------------------------------------------
    
    */

    let scheme = null;
    if (validatedData.schemeId !== undefined) {
        if (validatedData.schemeId === "" ) {
            updateData.schemeId = null;
            updateData.schemeAdditionalInformation = [];
        } else {
            scheme = await prisma.patientScheme.findFirst({
                    where: {
                        id: Number(
                            validatedData.schemeId
                        ),

                        status: "ACTIVE",
                    },

                    select: {
                        id: true,
                        eligibilityGender: true,
                        ageCriteriaType: true,
                        ageLimit: true,
                        minimumAge: true,
                        maximumAge: true,
                        collectAdditionalInformation: true,
                        additionalInformationFields: true,
                    },
                });

            if (!scheme) {
                const error = new Error("Selected scheme does not exist or is inactive");
                error.code ="PATIENT_UPDATE_VALIDATION_ERROR";
                throw error;
            }
            updateData.schemeId = scheme.id;
        }
    } else if (
        dobWasProvided ||
        ageWasProvided ||
        validatedData.gender !== undefined
    ) {
        if (existingPatient.schemeId) {
            scheme = await prisma.patientScheme.findUnique({
                where: { id: existingPatient.schemeId },
                select: {
                    id: true,
                    eligibilityGender: true,
                    ageCriteriaType: true,
                    ageLimit: true,
                    minimumAge: true,
                    maximumAge: true,
                    collectAdditionalInformation: true,
                    additionalInformationFields: true,
                },
            });
        }
    } else if (existingPatient.schemeId) {
        scheme = await prisma.patientScheme.findUnique({
            where: { id: existingPatient.schemeId },
            select: {
                id: true,
                eligibilityGender: true,
                ageCriteriaType: true,
                ageLimit: true,
                minimumAge: true,
                maximumAge: true,
                collectAdditionalInformation: true,
                additionalInformationFields: true,
            },
        });
    }

    if (scheme) {
        const finalDateOfBirth = updateData.dateOfBirth || existingPatient.dateOfBirth;
        const finalAge = calculateAge(finalDateOfBirth, updateData.age ?? existingPatient.age);
        const finalGender = updateData.gender || existingPatient.gender;
        validateSchemeEligibility(
            scheme,
            finalGender,
            finalAge,
            "PATIENT_UPDATE_VALIDATION_ERROR"
        );

        const submittedInformation = validatedData.schemeAdditionalInformation;
        const sourceInformation = submittedInformation !== undefined
            ? submittedInformation
            : validatedData.schemeId !== undefined &&
                Number(validatedData.schemeId) !== existingPatient.schemeId
                ? []
                : existingPatient.schemeAdditionalInformation;
        updateData.schemeAdditionalInformation = validateSchemeAdditionalInformation(
            scheme,
            sourceInformation
        );
    } else if (validatedData.schemeAdditionalInformation !== undefined) {
        if (validatedData.schemeAdditionalInformation.length > 0) {
            const error = new Error("Additional information cannot be submitted without a scheme");
            error.code = "SCHEME_FIELD_VALIDATION_ERROR";
            throw error;
        }
        updateData.schemeAdditionalInformation = [];
    }

    /*
    |--------------------------------------------------------------------------
    | Update Database
    |--------------------------------------------------------------------------
    */

    const updatedPatient = await prisma.patient.update({
            where: {
                id: patientIdNum,
            },

            data: updateData,

            select:
                patientDetailsSelect,
        });

    return updatedPatient;
}


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
    registerPatientRecord,
    searchPatients,
    getTodayPatients,
    getPatientDetails,
    updatePatientRecord,
};
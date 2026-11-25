const { z } = require("zod");

const { prisma } = require("../../config/prisma");
const { validateSchemeConfiguration } = require("./schemeEligibility");


const schemeConfigurationFields = {
    eligibilityGender: z.enum(["ALL", "NOT_APPLICABLE", "FEMALE", "MALE", "TRANSGENDER"]),
    ageCriteriaType: z.enum(["ALL", "NOT_APPLICABLE", "UNDER", "ABOVE", "RANGE"]),
    ageLimit: z.number().int().min(0).max(150).nullable(),
    minimumAge: z.number().int().min(0).max(150).nullable(),
    maximumAge: z.number().int().min(0).max(150).nullable(),
    collectAdditionalInformation: z.boolean(),
    additionalInformationFields: z.array(z.object({
        key: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
        label: z.string().trim().min(1, "Additional information field labels are required").max(100),
    }).strict()).max(50),
};

const schemeConfigurationDefaults = {
    eligibilityGender: "NOT_APPLICABLE",
    ageCriteriaType: "NOT_APPLICABLE",
    ageLimit: null,
    minimumAge: null,
    maximumAge: null,
    collectAdditionalInformation: false,
    additionalInformationFields: [],
};

const schemeConfigurationSelect = {
    eligibilityGender: true,
    ageCriteriaType: true,
    ageLimit: true,
    minimumAge: true,
    maximumAge: true,
    collectAdditionalInformation: true,
    additionalInformationFields: true,
};

const createSchemeSchema = z
    .object({
        code: z.string().trim().min(1, "Scheme code is required").max(50),
        name: z.string().trim().min(1, "Scheme name is required").max(100),
        ...Object.fromEntries(Object.entries(schemeConfigurationFields).map(([key, schema]) => [
            key,
            schema.optional(),
        ])),
    })
    .strict();

const updateSchemeSchema = z
    .object({
        name: z.string().trim().min(1, "Scheme name is required").max(100).optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        ...Object.fromEntries(Object.entries(schemeConfigurationFields).map(([key, schema]) => [
            key,
            schema.optional(),
        ])),
    })
    .strict();

function normalizeCode(code) {
    return code.trim().toUpperCase().replace(/\s+/g, "_");
}

function isValidCode(code) {
    return /^[A-Z0-9_]+$/.test(code);
}

function getRequestRole(user) {
    if (user?.role && typeof user.role === "object") {
        return String(user.role.name || "").toUpperCase();
    }
    return String(user?.role || "").toUpperCase();
}

function validationError(message) {
    const error = new Error(message);
    error.code = "SCHEME_VALIDATION_ERROR";
    return error;
}

function duplicateError(message) {
    const error = new Error(message);
    error.code = "SCHEME_DUPLICATE";
    return error;
}

async function listPatientSchemes(role) {
    const isAdmin = String(role).toUpperCase() === "ADMIN";

    return prisma.patientScheme.findMany({
        where: isAdmin
            ? undefined
            : {
                  status: "ACTIVE",
              },
        select: {
            id: true,
            code: true,
            name: true,
            ...schemeConfigurationSelect,
            ...(isAdmin
                ? {
                      status: true,
                      createdAt: true,
                      updatedAt: true,
                  }
                : {}),
        },
        orderBy: {
            name: "asc",
        },
    });
}

async function listActivePatientSchemes() {
    return listPatientSchemes("RECEPTION");
}

async function createPatientScheme(data) {
    const validatedData = createSchemeSchema.parse({
        ...schemeConfigurationDefaults,
        ...data,
    });

    const code = normalizeCode(validatedData.code);

    if (!isValidCode(code)) {
        throw validationError("Scheme code may only contain letters, numbers, and underscores");
    }

    const schemeConfiguration = validateSchemeConfiguration(validatedData);

    try {
        return await prisma.patientScheme.create({
            data: {
                code,
                name: validatedData.name,
                ...schemeConfiguration,
                status: "ACTIVE",
            },

            select: {
                id: true,
                code: true,
                name: true,
                ...schemeConfigurationSelect,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError("A scheme with this code or name already exists");
        }
        throw error;
    }
}

async function updatePatientScheme(id, data) {
    const schemeId = Number(id);

    if (!Number.isInteger(schemeId) || schemeId < 1) {
        throw validationError("Invalid scheme id");
    }

    const validatedData = updateSchemeSchema.parse(data);

    if (
        validatedData.name === undefined &&
        validatedData.status === undefined &&
        !Object.keys(schemeConfigurationFields).some((field) => validatedData[field] !== undefined)
    ) {
        throw validationError("Provide at least one field to update");
    }

    const existing = await prisma.patientScheme.findUnique({
        where: {
            id: schemeId,
        },
        select: {
            id: true,
            code: true,
            ...schemeConfigurationSelect,
        },
    });

    if (!existing) {
        const error = new Error("Patient scheme not found");
        error.code = "SCHEME_NOT_FOUND";
        throw error;
    }

    const schemeConfiguration = validateSchemeConfiguration({
        ...schemeConfigurationDefaults,
        ...existing,
        ...validatedData,
    });

    try {
        return await prisma.patientScheme.update({
            where: {
                id: schemeId,
            },

            data: {
                ...(validatedData.name !== undefined
                    ? {
                          name: validatedData.name,
                      }
                    : {}),

                ...(validatedData.status !== undefined
                    ? {
                          status: validatedData.status,
                      }
                    : {}),
                ...Object.fromEntries(
                    Object.keys(schemeConfigurationFields)
                        .filter((field) => validatedData[field] !== undefined)
                        .map((field) => [field, schemeConfiguration[field]])
                ),
            },

            select: {
                id: true,
                code: true,
                name: true,
                ...schemeConfigurationSelect,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError("A scheme with this name already exists");
        }
        throw error;
    }
}

module.exports = {
    getRequestRole,
    listPatientSchemes,
    listActivePatientSchemes,
    createPatientScheme,
    updatePatientScheme,
};
const { z } = require("zod");

const { prisma } = require("../../config/prisma");


const booleanField = z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true");

const createSchemeSchema = z
    .object({
        code: z
            .string()
            .trim()
            .min(1, "Scheme code is required")
            .max(50),
        name: z
            .string()
            .trim()
            .min(1, "Scheme name is required")
            .max(100),
        discountType: z
            .enum(["NONE", "PERCENTAGE", "FIXED"])
            .default("NONE"),
        discountValue: z
            .coerce
            .number()
            .min(0, "Discount value cannot be negative")
            .default(0),
    })
    .strict();

const updateSchemeSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Scheme name is required")
            .max(100)
            .optional(),
        discountType: z
            .enum(["NONE", "PERCENTAGE", "FIXED"])
            .optional(),
        discountValue: z
            .coerce
            .number()
            .min(0, "Discount value cannot be negative")
            .optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
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

function validateDiscount(discountType, discountValue) {
    if (discountType === "NONE") {
        if (discountValue !== 0) {
            throw validationError(
                "Discount value must be 0 when discount type is NONE"
            );
        }

        return;
    }

    if (discountValue <= 0) {
        throw validationError(
            "Discount value must be greater than 0"
        );
    }

    if (
        discountType === "PERCENTAGE" &&
        discountValue > 100
    ) {
        throw validationError(
            "Percentage discount cannot exceed 100%"
        );
    }
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
            discountType: true,
            discountValue: true,
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
    const validatedData = createSchemeSchema.parse(data);

    const code = normalizeCode(validatedData.code);

    if (!isValidCode(code)) {
        throw validationError(
            "Scheme code may only contain letters, numbers, and underscores"
        );
    }

    validateDiscount(
        validatedData.discountType,
        validatedData.discountValue
    );

    try {
        return await prisma.patientScheme.create({
            data: {
                code,
                name: validatedData.name,
                discountType: validatedData.discountType,
                discountValue: validatedData.discountValue,
                status: "ACTIVE",
            },

            select: {
                id: true,
                code: true,
                name: true,
                discountType: true,
                discountValue: true,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError(
                "A scheme with this code or name already exists"
            );
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
        validatedData.discountType === undefined &&
        validatedData.discountValue === undefined &&
        validatedData.status === undefined
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
            discountType: true,
            discountValue: true,
        },
    });

    if (!existing) {
        const error = new Error("Patient scheme not found");
        error.code = "SCHEME_NOT_FOUND";
        throw error;
    }

    const discountType =
        validatedData.discountType ?? existing.discountType;

    const discountValue =
        validatedData.discountValue !== undefined
            ? validatedData.discountValue
            : Number(existing.discountValue);

    validateDiscount(discountType, discountValue);

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

                ...(validatedData.discountType !== undefined
                    ? {
                          discountType:
                              validatedData.discountType,
                      }
                    : {}),

                ...(validatedData.discountValue !== undefined
                    ? {
                          discountValue:
                              validatedData.discountValue,
                      }
                    : {}),

                ...(validatedData.status !== undefined
                    ? {
                          status: validatedData.status,
                      }
                    : {}),
            },

            select: {
                id: true,
                code: true,
                name: true,
                discountType: true,
                discountValue: true,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError(
                "A scheme with this name already exists"
            );
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
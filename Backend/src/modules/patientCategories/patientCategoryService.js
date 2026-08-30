const { z } = require("zod");

const { prisma } = require("../../config/prisma");

const GENERAL_CODE = "GENERAL";

const booleanField = z.union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true");

const createCategorySchema = z.object({
    code: z.string().trim().min(1, "Category code is required").max(50),
    name: z.string().trim().min(1, "Category name is required").max(100),
    discountEligible: booleanField.optional().default(false),
}).strict();

const updateCategorySchema = z.object({
    name: z.string().trim().min(1, "Category name is required").max(100).optional(),
    discountEligible: booleanField.optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict();

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
    error.code = "CATEGORY_VALIDATION_ERROR";
    return error;
}

function duplicateError(message) {
    const error = new Error(message);
    error.code = "CATEGORY_DUPLICATE";
    return error;
}

async function listPatientCategories(role) {
    const isAdmin = getRequestRole({ role }) === "ADMIN" || role === "ADMIN";

    return prisma.patientCategory.findMany({
        where: isAdmin
            ? undefined
            : {
                status: "ACTIVE",
            },
        select: {
            id: true,
            code: true,
            name: true,
            discountEligible: true,
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

async function listActivePatientCategories() {
    return listPatientCategories("RECEPTION");
}

async function createPatientCategory(data) {
    const validatedData = createCategorySchema.parse(data);
    const code = normalizeCode(validatedData.code);

    if (!isValidCode(code)) {
        throw validationError("Category code may only contain letters, numbers, and underscores");
    }

    try {
        return await prisma.patientCategory.create({
            data: {
                code,
                name: validatedData.name,
                discountEligible: validatedData.discountEligible,
                status: "ACTIVE",
            },
            select: {
                id: true,
                code: true,
                name: true,
                discountEligible: true,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError("A category with this code or name already exists");
        }

        throw error;
    }
}

async function updatePatientCategory(id, data) {
    const categoryId = Number(id);

    if (!Number.isInteger(categoryId) || categoryId < 1) {
        throw validationError("Invalid category id");
    }

    const validatedData = updateCategorySchema.parse(data);

    if (
        validatedData.name === undefined &&
        validatedData.discountEligible === undefined &&
        validatedData.status === undefined
    ) {
        throw validationError("Provide at least one field to update");
    }

    const existing = await prisma.patientCategory.findUnique({
        where: {
            id: categoryId,
        },
        select: {
            id: true,
            code: true,
        },
    });

    if (!existing) {
        const error = new Error("Patient category not found");
        error.code = "CATEGORY_NOT_FOUND";
        throw error;
    }

    if (existing.code === GENERAL_CODE && validatedData.status === "INACTIVE") {
        throw validationError("The GENERAL category cannot be deactivated");
    }

    try {
        return await prisma.patientCategory.update({
            where: {
                id: categoryId,
            },
            data: {
                ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
                ...(validatedData.discountEligible !== undefined
                    ? { discountEligible: validatedData.discountEligible }
                    : {}),
                ...(validatedData.status !== undefined ? { status: validatedData.status } : {}),
            },
            select: {
                id: true,
                code: true,
                name: true,
                discountEligible: true,
                status: true,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw duplicateError("A category with this name already exists");
        }

        throw error;
    }
}

module.exports = {
    GENERAL_CODE,
    getRequestRole,
    listPatientCategories,
    listActivePatientCategories,
    createPatientCategory,
    updatePatientCategory,
};

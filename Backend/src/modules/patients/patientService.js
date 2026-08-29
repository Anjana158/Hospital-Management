const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");

const patientSearchSchema = z.object({
    q: z.string().trim().min(2, "Search query must contain at least 2 characters").max(100),
    field: z.enum(["all", "uhid", "name", "phone"]).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const phoneSchema = z.string()
    .trim()
    .min(1, "Phone number is required")
    .max(30, "Phone number is too long")
    .refine((value) => /^[+\d\s().-]+$/.test(value), {
        message: "Phone number contains invalid characters",
    })
    .refine((value) => {
        const digitCount = value.replace(/\D/g, "").length;
        return digitCount >= 7 && digitCount <= 15;
    }, {
        message: "Phone number must contain between 7 and 15 digits",
    });

const patientRegistrationSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    middleName: z.string().trim().max(100).optional().or(z.literal("")),
    lastName: z.string().trim().max(100).optional().or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
    phone: phoneSchema,
    alternatePhone: phoneSchema.optional().or(z.literal("")),
    email: z.string().trim().email("Email must be valid").max(255).optional().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(100).optional().or(z.literal("")),
    categoryId: z.coerce.number().int().positive("Patient category is required"),
}).strict();

function parseDateOfBirth(value) {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date > new Date()) {
        const error = new Error("Date of birth must be a valid past date");
        error.code = "PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    return date;
}

function generateUhid() {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const randomPart = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `UHID-${datePart}-${randomPart}`;
}

function normalizePhone(phone) {
    return phone.replace(/\D/g, "");
}

const patientSummarySelect = {
    id: true,
    uhid: true,
    firstName: true,
    middleName: true,
    lastName: true,
    dateOfBirth: true,
    gender: true,
    phone: true,
    alternatePhone: true,
    status: true,
    category: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
    updatedAt: true,
};

const patientDetailsSelect = {
    id: true,
    uhid: true,
    firstName: true,
    middleName: true,
    lastName: true,
    dateOfBirth: true,
    gender: true,
    phone: true,
    alternatePhone: true,
    email: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    status: true,
    archivedAt: true,
    category: {
        select: {
            id: true,
            code: true,
            name: true,
            discountEligible: true,
        },
    },
    createdAt: true,
    updatedAt: true,
};

const patientUpdateSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100).optional(),
    middleName: z.string().trim().max(100).optional().or(z.literal("")),
    lastName: z.string().trim().max(100).optional().or(z.literal("")),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
    phone: phoneSchema.optional(),
    alternatePhone: phoneSchema.optional().or(z.literal("")),
    email: z.string().trim().email("Email must be valid").max(255).optional().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    state: z.string().trim().max(100).optional().or(z.literal("")),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(100).optional().or(z.literal("")),
    categoryId: z.coerce.number().int().positive("Patient category is required").optional(),
}).strict();

async function getPatientDetails(identifier, lookupType) {
    let patient;

    if (lookupType === "id") {
        const patientId = Number(identifier);
        if (!Number.isInteger(patientId) || patientId < 1) {
            const error = new Error("Patient ID must be a positive integer");
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

async function searchPatients(query) {
    const validatedQuery = patientSearchSchema.parse(query);
    const normalizedQuery = normalizePhone(validatedQuery.q);
    const searchConditions = [];

    if (validatedQuery.field === "uhid" || validatedQuery.field === "all") {
        searchConditions.push({
            uhid: {
                contains: validatedQuery.q,
                mode: "insensitive",
            },
        });
    }

    if (validatedQuery.field === "name" || validatedQuery.field === "all") {
        searchConditions.push(
            { firstName: { contains: validatedQuery.q, mode: "insensitive" } },
            { middleName: { contains: validatedQuery.q, mode: "insensitive" } },
            { lastName: { contains: validatedQuery.q, mode: "insensitive" } },
        );
    }

    if (validatedQuery.field === "phone" || (validatedQuery.field === "all" && normalizedQuery.length >= 3)) {
        if (normalizedQuery.length < 3) {
            const error = new Error("Phone search must contain at least 3 digits");
            error.code = "PATIENT_SEARCH_VALIDATION_ERROR";
            throw error;
        }

        searchConditions.push(
            { phone: { contains: normalizedQuery } },
            { alternatePhone: { contains: normalizedQuery } },
        );
    }

    const where = { OR: searchConditions };
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
        prisma.patient.count({ where }),
    ]);

    const totalPages = Math.ceil(total / validatedQuery.limit);
    return {
        items,
        pagination: {
            page: validatedQuery.page,
            limit: validatedQuery.limit,
            total,
            totalPages,
            hasNextPage: validatedQuery.page < totalPages,
        },
    };
}

async function registerPatientRecord(data, createdBy) {
    const validatedData = patientRegistrationSchema.parse(data);
    const category = await prisma.patientCategory.findFirst({
        where: {
            id: validatedData.categoryId,
            status: "ACTIVE",
        },
        select: {
            id: true,
        },
    });

    if (!category) {
        const error = new Error("Selected patient category does not exist or is inactive");
        error.code = "PATIENT_VALIDATION_ERROR";
        throw error;
    }

    const normalizedPhone = normalizePhone(validatedData.phone);
    const possibleDuplicates = await prisma.patient.findMany({
        where: {
            OR: [
                { phone: normalizedPhone },
                { alternatePhone: normalizedPhone },
            ],
        },
        select: {
            id: true,
            uhid: true,
            firstName: true,
            middleName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
            alternatePhone: true,
            status: true,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 10,
    });

    if (possibleDuplicates.length > 0) {
        const error = new Error("A patient with this phone number may already exist");
        error.code = "PATIENT_DUPLICATE_PHONE";
        error.duplicates = possibleDuplicates;
        throw error;
    }

    const patientData = {
        ...validatedData,
        dateOfBirth: parseDateOfBirth(validatedData.dateOfBirth),
        middleName: validatedData.middleName || undefined,
        lastName: validatedData.lastName || undefined,
        alternatePhone: validatedData.alternatePhone || undefined,
        email: validatedData.email || undefined,
        addressLine1: validatedData.addressLine1 || undefined,
        addressLine2: validatedData.addressLine2 || undefined,
        city: validatedData.city || undefined,
        state: validatedData.state || undefined,
        postalCode: validatedData.postalCode || undefined,
        country: validatedData.country || undefined,
        categoryId: category.id,
        phone: normalizedPhone,
        alternatePhone: validatedData.alternatePhone
            ? normalizePhone(validatedData.alternatePhone)
            : undefined,
    };

    delete patientData.dateOfBirth;
    if (validatedData.dateOfBirth) {
        patientData.dateOfBirth = parseDateOfBirth(validatedData.dateOfBirth);
    }
    delete patientData.categoryId;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await prisma.patient.create({
                data: {
                    ...patientData,
                    uhid: generateUhid(),
                    category: {
                        connect: {
                            id: category.id,
                        },
                    },
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
                    gender: true,
                    phone: true,
                    alternatePhone: true,
                    email: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    state: true,
                    postalCode: true,
                    country: true,
                    category: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
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

async function updatePatientRecord(patientId, data) {
    const patientIdNum = Number(patientId);
    if (!Number.isInteger(patientIdNum) || patientIdNum < 1) {
        const error = new Error("Patient ID must be a positive integer");
        error.code = "PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    const validatedData = patientUpdateSchema.parse(data);

    const editableFields = Object.keys(validatedData).filter(
        (key) => validatedData[key] !== undefined
    );
    if (editableFields.length === 0) {
        const error = new Error("At least one editable field must be provided");
        error.code = "PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    const existingPatient = await prisma.patient.findUnique({
        where: { id: patientIdNum },
        select: {
            id: true,
            phone: true,
            alternatePhone: true,
            categoryId: true,
        },
    });

    if (!existingPatient) {
        const error = new Error("Patient not found");
        error.code = "PATIENT_NOT_FOUND";
        throw error;
    }

    const updateData = {};

    if (validatedData.firstName !== undefined) {
        updateData.firstName = validatedData.firstName;
    }
    if (validatedData.gender !== undefined) {
        updateData.gender = validatedData.gender;
    }

    const optionalStringFields = [
        "middleName",
        "lastName",
        "email",
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "country",
    ];
    optionalStringFields.forEach((field) => {
        if (validatedData[field] !== undefined) {
            updateData[field] = validatedData[field] || null;
        }
    });

    if (validatedData.dateOfBirth !== undefined) {
        if (validatedData.dateOfBirth === "") {
            updateData.dateOfBirth = null;
        } else {
            updateData.dateOfBirth = parseDateOfBirth(validatedData.dateOfBirth);
        }
    }

    let newPhone = existingPatient.phone;
    let newAltPhone = existingPatient.alternatePhone;

    if (validatedData.phone !== undefined) {
        newPhone = normalizePhone(validatedData.phone);
        updateData.phone = newPhone;
    }

    if (validatedData.alternatePhone !== undefined) {
        if (validatedData.alternatePhone === "") {
            newAltPhone = null;
        } else {
            newAltPhone = normalizePhone(validatedData.alternatePhone);
        }
        updateData.alternatePhone = newAltPhone;
    }

    if (newPhone && newAltPhone && newPhone === newAltPhone) {
        const error = new Error(
            "Primary and alternate phone numbers cannot be the same"
        );
        error.code = "PATIENT_UPDATE_VALIDATION_ERROR";
        throw error;
    }

    if (
        validatedData.phone !== undefined ||
        validatedData.alternatePhone !== undefined
    ) {
        const phonesToCheck = [];
        if (newPhone) phonesToCheck.push(newPhone);
        if (newAltPhone) phonesToCheck.push(newAltPhone);

        const duplicates = await prisma.patient.findMany({
            where: {
                id: { not: patientIdNum },
                OR: [
                    { phone: { in: phonesToCheck } },
                    { alternatePhone: { in: phonesToCheck } },
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

        if (duplicates.length > 0) {
            const error = new Error(
                "A patient with this phone number may already exist"
            );
            error.code = "PATIENT_DUPLICATE_PHONE";
            error.duplicates = duplicates;
            throw error;
        }
    }

    if (validatedData.categoryId !== undefined) {
        const category = await prisma.patientCategory.findFirst({
            where: {
                id: validatedData.categoryId,
                status: "ACTIVE",
            },
            select: { id: true },
        });

        if (!category) {
            const error = new Error(
                "Selected patient category does not exist or is inactive"
            );
            error.code = "PATIENT_UPDATE_VALIDATION_ERROR";
            throw error;
        }

        updateData.categoryId = validatedData.categoryId;
    }

    const updatedPatient = await prisma.patient.update({
        where: { id: patientIdNum },
        data: updateData,
        select: patientDetailsSelect,
    });

    return updatedPatient;
}

module.exports = {
    registerPatientRecord,
    searchPatients,
    getPatientDetails,
    updatePatientRecord,
};
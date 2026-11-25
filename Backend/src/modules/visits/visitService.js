const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");
const DEFAULT_OP_FEE = 10;
const {
    calculateAge,
    resolveSchemeSelection,
    getSchemeEligibilitySnapshot,
    validateSchemeAdditionalInformation,
    validateSchemeEligibility,
} = require("../patientSchemes/schemeEligibility");

const registerVisitSchema = z.object({
    patientId: z.coerce.number().int().positive(),
    departmentId: z.coerce.number().int().positive(),
    schemeId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    paymentMethod: z.enum(["CASH", "GPAY", "POS"]).nullable().optional(),
    authCode: z.string().trim().optional(),
    visitType: z.enum([
        "NEW",
        "REVISIT",
    ]).optional(),
    opFee: z.coerce.number()
        .refine((value) => value === DEFAULT_OP_FEE, `OP fee is fixed at ${DEFAULT_OP_FEE}`)
        .default(DEFAULT_OP_FEE),
    schemeAdditionalInformation: z.array(z.object({
        key: z.string().trim().min(1).max(100),
        value: z.string().max(500),
    }).strict()).max(50).optional(),
});

function normalizeVisitPaymentMethod(paymentMethod) {
    return paymentMethod === "GPAY" ? "POS" : paymentMethod;
}


function getStartOfToday() {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}


const TOKEN_PREFIX = "HMS";

function formatTokenLabel(tokenNumber) {
    return `${TOKEN_PREFIX} ${tokenNumber}`;
}

function calculateVisitAmounts(opFee, selectedScheme) {
    const discountAmount = selectedScheme ? opFee : 0;
    return {
        discountAmount,
        finalFee: opFee - discountAmount,
    };
}

function getVisitPaymentDetails(finalFee, paymentMethod) {
    const normalizedMethod = normalizeVisitPaymentMethod(paymentMethod);
    if (finalFee === 0) {
        return {
            paymentStatus: "FREE",
            paymentMethod: "CASH",
        };
    }

    return normalizedMethod
        ? { paymentStatus: "PAID", paymentMethod: normalizedMethod }
        : { paymentStatus: "PENDING", paymentMethod: null };
}

function validateVisitPayment(finalFee, paymentMethod, authCode) {
    const normalizedMethod = normalizeVisitPaymentMethod(paymentMethod);
    if (finalFee > 0 && normalizedMethod === "POS" && !authCode?.trim()) {
        const error = new Error("Auth Code is required for POS payments");
        error.code = "VISIT_PAYMENT_VALIDATION_ERROR";
        throw error;
    }
}

function getTokenDate() {
    const now = new Date();

    return new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ));
}

function getTomorrow() {
    const tomorrow =
        getStartOfToday();

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );

    return tomorrow;
}


function createVisitNumber(date, id) {
    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `OP-${year}${month}${day}-${String(id).padStart(6, "0")}`;
}


async function getPatientDepartmentVisitHistory(patientId, departmentId) {
    const parsedPatientId = Number(patientId);
    const parsedDepartmentId = Number(departmentId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId < 1) {
        const error = new Error("Patient ID is invalid");
        error.code = "PATIENT_HISTORY_VALIDATION_ERROR";
        throw error;
    }

    if (!Number.isInteger(parsedDepartmentId) || parsedDepartmentId < 1) {
        const error = new Error("Department ID is invalid");
        error.code = "DEPARTMENT_HISTORY_VALIDATION_ERROR";
        throw error;
    }

    const patient = await prisma.patient.findUnique({
        where: { id: parsedPatientId },
    });

    if (!patient) {
        const error = new Error("Patient not found");
        error.code = "PATIENT_NOT_FOUND";
        throw error;
    }

    const department = await prisma.department.findUnique({
        where: { id: parsedDepartmentId },
    });

    if (!department) {
        const error = new Error("Department not found");
        error.code = "DEPARTMENT_NOT_FOUND";
        throw error;
    }

    const today = getStartOfToday();
    const tomorrow = getTomorrow();

    const previousVisits = await prisma.patientVisit.findMany({
        where: {
            patientId: parsedPatientId,
            departmentId: parsedDepartmentId,
            status: {
                not: "CANCELLED",
            },
            visitDate: {
                lt: today,
            },
        },
        orderBy: {
            visitDate: "desc",
        },
    });

    const visitsToday = await prisma.patientVisit.findMany({
        where: {
            patientId: parsedPatientId,
            departmentId: parsedDepartmentId,
            status: {
                not: "CANCELLED",
            },
            visitDate: {
                gte: today,
                lt: tomorrow,
            },
        },
        orderBy: {
            visitDate: "desc",
        },
    });

    const hasPreviousVisit = previousVisits.length > 0;
    const hasVisitToday = visitsToday.length > 0;
    const visitType = hasPreviousVisit ? "REVISIT" : "NEW";
    const revisitCount = previousVisits.length;

    return {
        patientId: parsedPatientId,
        departmentId: parsedDepartmentId,
        hasPreviousVisit,
        hasVisitToday,
        visitType,
        revisitCount,
    };
}


async function registerVisitRecord(
    data,
    userId
) {
    const validated =
        registerVisitSchema.parse(data);

    const {
        patientId,
        departmentId,
        schemeId,
        opFee,
        paymentMethod,
        authCode,
        schemeAdditionalInformation: submittedSchemeAdditionalInformation,
    } = validated;

    const today = getStartOfToday();
    const tomorrow = getTomorrow();

    try {
        return await prisma.$transaction(
            async (tx) => {

            /*
            |--------------------------------------------------------------------------
            | Patient
            |--------------------------------------------------------------------------
            */

            const patient =
                await tx.patient.findUnique({
                    where: {
                        id: patientId,
                    },
                    include: {
                        scheme: true,
                    },
                });

            if (!patient) {
                const error =
                    new Error(
                        "Patient not found"
                    );

                error.code =
                    "PATIENT_NOT_FOUND";

                throw error;
            }

            if (
                patient.status !==
                "ACTIVE"
            ) {
                const error =
                    new Error(
                        "Patient is not active"
                    );

                error.code =
                    "PATIENT_INACTIVE";

                throw error;
            }


            /*
            |--------------------------------------------------------------------------
            | Department
            |--------------------------------------------------------------------------
            */

            const department =
                await tx.department.findUnique({
                    where: {
                        id: departmentId,
                    },
                });

            if (!department) {
                const error =
                    new Error(
                        "Department not found"
                    );

                error.code =
                    "DEPARTMENT_NOT_FOUND";

                throw error;
            }

            if (
                department.status !==
                "ACTIVE"
            ) {
                const error =
                    new Error(
                        "Selected department is inactive"
                    );

                error.code =
                    "DEPARTMENT_INACTIVE";

                throw error;
            }

            await tx.$executeRaw`
                SELECT pg_advisory_xact_lock(
                    CAST(${patientId} AS INTEGER),
                    CAST(${departmentId} AS INTEGER)
                )
            `;

            const sameDayVisit = await tx.patientVisit.findFirst({
                where: {
                    patientId,
                    departmentId,
                    status: {
                        not: "CANCELLED",
                    },
                    visitDate: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                orderBy: {
                    visitDate: "desc",
                },
            });

            if (sameDayVisit) {
                const error = new Error(
                    "Patient has already registered an OP visit in this department today."
                );
                error.code = "DUPLICATE_SAME_DAY_VISIT";
                throw error;
            }

            const previousVisits = await tx.patientVisit.findMany({
                where: {
                    patientId,
                    departmentId,
                    status: {
                        not: "CANCELLED",
                    },
                    visitDate: {
                        lt: today,
                    },
                },
                orderBy: {
                    visitDate: "desc",
                },
            });

            const computedVisitType = previousVisits.length > 0 ? "REVISIT" : "NEW";
            const revisitCount = previousVisits.length;

            /*
            |--------------------------------------------------------------------------
            | Discount
            |--------------------------------------------------------------------------
            */

            const patientAge = calculateAge(patient.dateOfBirth, patient.age);
            const activeSchemes = await tx.patientScheme.findMany({
                where: { status: "ACTIVE" },
                orderBy: { name: "asc" },
            });
            const selectedScheme = resolveSchemeSelection(
                activeSchemes,
                patient.gender,
                patientAge,
                schemeId,
                "VISIT_SCHEME_INELIGIBLE"
            );

            let schemeAdditionalInformation = [];
            let schemeEligibilitySnapshot = null;

            if (selectedScheme) {
                schemeAdditionalInformation = validateSchemeAdditionalInformation(
                    selectedScheme,
                    submittedSchemeAdditionalInformation ??
                        (patient.scheme?.id === selectedScheme.id
                            ? patient.schemeAdditionalInformation
                            : [])
                );
                schemeEligibilitySnapshot = getSchemeEligibilitySnapshot(selectedScheme);
            } else if (
                submittedSchemeAdditionalInformation?.length
            ) {
                const error = new Error(
                    "Additional information cannot be submitted without an active scheme"
                );
                error.code = "SCHEME_FIELD_VALIDATION_ERROR";
                throw error;
            }

            const { discountAmount, finalFee } = calculateVisitAmounts(opFee, selectedScheme);
            const effectivePaymentMethod = finalFee === 0 ? "CASH" : paymentMethod;
            validateVisitPayment(finalFee, effectivePaymentMethod, authCode);
            const paymentDetails = getVisitPaymentDetails(finalFee, effectivePaymentMethod);


            /*
            |--------------------------------------------------------------------------
            | Department token
            |--------------------------------------------------------------------------
            |
            | One counter per department per hospital day.
            | INSERT ... ON CONFLICT increments that row atomically, so two
            | receptionists cannot take the same number.
            |
            */

            const tokenDate = getTokenDate();
            const tokenDateValue = tokenDate.toISOString().slice(0, 10);
            const tokenRows = await tx.$queryRaw`
                INSERT INTO "DailyTokenCounter" (
                    "departmentId",
                    "tokenDate",
                    "nextToken",
                    "createdAt",
                    "updatedAt"
                )
                VALUES (
                    ${departmentId},
                    ${tokenDateValue}::date,
                    2,
                    NOW(),
                    NOW()
                )
                ON CONFLICT ("departmentId", "tokenDate")
                DO UPDATE SET
                    "nextToken" = "DailyTokenCounter"."nextToken" + 1,
                    "updatedAt" = NOW()
                RETURNING "nextToken"
            `;

            const tokenNumber = Number(tokenRows[0].nextToken) - 1;
            const tokenLabel = formatTokenLabel(tokenNumber);


            /*
            |--------------------------------------------------------------------------
            | Create Visit
            |--------------------------------------------------------------------------
            */

            const temporaryVisitNumber =
                `TEMP-${crypto.randomUUID()}`;


            const visit =
                await tx.patientVisit.create({
                    data: {
                        visitNumber:
                            temporaryVisitNumber,

                        tokenNumber,
                        tokenPrefix: TOKEN_PREFIX,
                        tokenLabel,
                        tokenDate,

                        visitDate:
                            new Date(),

                        visitType:
                            computedVisitType,

                        revisitCount,

                        status:
                            "REGISTERED",

                        patientId,

                        departmentId,

                        createdBy:
                            userId,

                        genderAtVisit:
                            patient.gender,

                        opFee,

                        discountAmount,

                        finalFee,
                        ...paymentDetails,
                        paymentAuthCode:
                            effectivePaymentMethod === "POS" ? authCode.trim() : null,
                        schemeIdAtVisit: selectedScheme
                            ? selectedScheme.id
                            : null,
                        schemeCodeAtVisit: selectedScheme
                            ? selectedScheme.code
                            : null,
                        schemeNameAtVisit: selectedScheme
                            ? selectedScheme.name
                            : null,
                        schemeDiscountTypeAtVisit: selectedScheme
                            ? "PERCENTAGE"
                            : null,
                        schemeDiscountValueAtVisit: selectedScheme
                            ? 100
                            : null,
                        schemeEligibilityAtVisit: schemeEligibilitySnapshot,
                        schemeAdditionalInformation,
                    },

                    include: {
                        patient: {
                            include: {
                                scheme: true,
                            },
                        },

                        department: true,
                    },
                });


            /*
            |--------------------------------------------------------------------------
            | Permanent OP Number
            |--------------------------------------------------------------------------
            */

            const visitNumber =
                createVisitNumber(
                    visit.visitDate,
                    visit.id
                );


            const updatedVisit =
                await tx.patientVisit.update({
                    where: {
                        id: visit.id,
                    },

                    data: {
                        visitNumber,
                    },

                    include: {
                        patient: {
                            include: {
                                scheme: true,
                            },
                        },

                        department: true,
                    },
                });


                return {
                    visit:
                        updatedVisit,

                    tokenNumber,
                    tokenLabel,
                };
            }
        );
    } catch (error) {
        const target = error.meta?.target;
        const targetText = Array.isArray(target)
            ? target.join(",")
            : String(target || "");

        if (
            error.code === "P2002" &&
            targetText.includes("tokenNumber")
        ) {
            const tokenError = new Error(
                "Unable to assign token number. Please try again."
            );
            tokenError.code = "TOKEN_ASSIGNMENT_FAILED";
            throw tokenError;
        }

        if (error.code === "P2002") {
            const duplicateError = new Error(
                "Patient has already registered an OP visit in this department today."
            );
            duplicateError.code = "DUPLICATE_SAME_DAY_VISIT";
            throw duplicateError;
        }

        throw error;
    }
}




/*
|--------------------------------------------------------------------------
| Today's OP Visits
|--------------------------------------------------------------------------
*/

async function getTodayVisitRecords(page = 1, limit = 20) {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        const error = new Error("Page must be a positive integer");
        error.code = "VISIT_TODAY_VALIDATION_ERROR";
        throw error;
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        const error = new Error("Limit must be between 1 and 50");
        error.code = "VISIT_TODAY_VALIDATION_ERROR";
        throw error;
    }

    const today = getStartOfToday();
    const tomorrow = getTomorrow();
    const skip = (parsedPage - 1) * parsedLimit;

    const where = {
        visitDate: {
            gte: today,
            lt: tomorrow,
        },
        status: {
            not: "CANCELLED",
        },
    };

    const [items, total] = await prisma.$transaction([
        prisma.patientVisit.findMany({
            where,
            include: {
                patient: {
                    include: {
                        scheme: true,
                    },
                },
                department: true,
            },
            orderBy: [
                {
                    tokenNumber: "desc",
                },
                {
                    visitDate: "desc",
                },
            ],
            skip,
            take: parsedLimit,
        }),
        prisma.patientVisit.count({ where }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return {
        items,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages,
            hasNextPage: parsedPage < totalPages,
            hasPreviousPage: parsedPage > 1,
        },
    };
}

async function getPatientVisitRecord(id) {
    const visitId = Number(id);

    if (!Number.isInteger(visitId) || visitId < 1) {
        const error = new Error("Visit ID must be a positive integer");
        error.code = "VISIT_VALIDATION_ERROR";
        throw error;
    }

    const visit = await prisma.patientVisit.findUnique({
        where: { id: visitId },
        include: {
            patient: true,
            department: true,
        },
    });

    if (!visit) {
        const error = new Error("OP visit not found");
        error.code = "VISIT_NOT_FOUND";
        throw error;
    }

    return visit;
}

async function getPatientVisitHistory(patientId) {
    const parsedPatientId = Number(patientId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId < 1) {
        const error = new Error("Patient ID must be a positive integer");
        error.code = "PATIENT_HISTORY_VALIDATION_ERROR";
        throw error;
    }

    const patient = await prisma.patient.findUnique({
        where: { id: parsedPatientId },
        select: { id: true },
    });

    if (!patient) {
        const error = new Error("Patient not found");
        error.code = "PATIENT_NOT_FOUND";
        throw error;
    }

    return prisma.patientVisit.findMany({
        where: { patientId: parsedPatientId },
        include: {
            patient: true,
            department: true,
        },
        orderBy: [
            { visitDate: "desc" },
            { id: "desc" },
        ],
    });
}

module.exports = {
    calculateVisitAmounts,
    getVisitPaymentDetails,
    validateVisitPayment,
    registerVisitSchema,
    registerVisitRecord,
    getPatientDepartmentVisitHistory,
    getTodayVisitRecords,
    getPatientVisitRecord,
    getPatientVisitHistory,
};
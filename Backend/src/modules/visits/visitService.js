const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");

const registerVisitSchema = z.object({
    patientId: z.coerce.number().int().positive(),
    departmentId: z.coerce.number().int().positive(),
    paymentMethod: z.enum(["CASH", "GPAY"]).nullable().optional(),
    visitType: z.enum([
        "NEW",
        "REVISIT",
    ]).optional(),
    opFee: z.coerce
        .number()
        .min(0)
        .max(100000),
});


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
        opFee,
        paymentMethod,
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

            let discountAmount = 0;

            if (
                patient.scheme &&
                patient.scheme.status ===
                    "ACTIVE"
            ) {
                if (
                    patient.scheme.discountType ===
                    "PERCENTAGE"
                ) {
                    discountAmount =
                        (
                            opFee *
                            Number(
                                patient.scheme.discountValue
                            )
                        ) / 100;
                }

                if (
                    patient.scheme.discountType ===
                    "FIXED"
                ) {
                    discountAmount =
                        Number(
                            patient.scheme.discountValue
                        );
                }
            }

            discountAmount =
                Math.min(
                    discountAmount,
                    opFee
                );

            const finalFee =
                opFee -
                discountAmount;

            if (finalFee > 0 && !paymentMethod) {
                const error = new Error("Payment method is required for paid OP visits");
                error.code = "PAYMENT_METHOD_REQUIRED";
                throw error;
            }


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
                        paymentStatus: finalFee > 0 ? "PAID" : "FREE",
                        paymentMethod: finalFee > 0 ? paymentMethod : null,
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
    registerVisitRecord,
    getPatientDepartmentVisitHistory,
    getTodayVisitRecords,
    getPatientVisitRecord,
    getPatientVisitHistory,
};
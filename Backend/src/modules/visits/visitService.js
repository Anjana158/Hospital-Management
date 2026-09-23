const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");

const registerVisitSchema = z.object({
    patientId: z.coerce.number().int().positive(),
    departmentId: z.coerce.number().int().positive(),
    doctorId: z.coerce.number().int().positive(),
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


async function getPatientDoctorVisitHistory(patientId, doctorId) {
    const parsedPatientId = Number(patientId);
    const parsedDoctorId = Number(doctorId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId < 1) {
        const error = new Error("Patient ID is invalid");
        error.code = "PATIENT_HISTORY_VALIDATION_ERROR";
        throw error;
    }

    if (!Number.isInteger(parsedDoctorId) || parsedDoctorId < 1) {
        const error = new Error("Doctor ID is invalid");
        error.code = "DOCTOR_HISTORY_VALIDATION_ERROR";
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

    const doctor = await prisma.doctor.findUnique({
        where: { id: parsedDoctorId },
    });

    if (!doctor) {
        const error = new Error("Doctor not found");
        error.code = "DOCTOR_NOT_FOUND";
        throw error;
    }

    const today = getStartOfToday();
    const tomorrow = getTomorrow();

    const previousVisits = await prisma.patientVisit.findMany({
        where: {
            patientId: parsedPatientId,
            doctorId: parsedDoctorId,
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
            doctorId: parsedDoctorId,
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
        doctorId: parsedDoctorId,
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
        doctorId,
        opFee,
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


            /*
            |--------------------------------------------------------------------------
            | Doctor
            |--------------------------------------------------------------------------
            */

            const doctor =
                await tx.doctor.findUnique({
                    where: {
                        id: doctorId,
                    },
                    include: {
                        department: true,
                    },
                });

            if (!doctor) {
                const error =
                    new Error(
                        "Doctor not found"
                    );

                error.code =
                    "DOCTOR_NOT_FOUND";

                throw error;
            }

            if (
                doctor.status !==
                "ACTIVE"
            ) {
                const error =
                    new Error(
                        "Selected doctor is inactive"
                    );

                error.code =
                    "DOCTOR_INACTIVE";

                throw error;
            }

            if (
                doctor.departmentId !==
                departmentId
            ) {
                const error =
                    new Error(
                        "Selected doctor does not belong to the selected department"
                    );

                error.code =
                    "DOCTOR_DEPARTMENT_MISMATCH";

                throw error;
            }


            const sameDayVisit = await tx.patientVisit.findFirst({
                where: {
                    patientId,
                    doctorId,
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
                    "Patient has already registered an OP visit with this doctor today."
                );
                error.code = "DUPLICATE_SAME_DAY_VISIT";
                throw error;
            }

            const previousVisits = await tx.patientVisit.findMany({
                where: {
                    patientId,
                    doctorId,
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


            /*
            |--------------------------------------------------------------------------
            | Daily Token
            |--------------------------------------------------------------------------
            */

            let counter =
                await tx.dailyTokenCounter.findUnique({
                    where: {
                        tokenDate: today,
                    },
                });


            let tokenNumber;


            if (!counter) {

                tokenNumber = 1;

                await tx.dailyTokenCounter.create({
                    data: {
                        tokenDate: today,
                        nextToken: 2,
                    },
                });

            } else {

                tokenNumber =
                    counter.nextToken;

                const updateResult =
                    await tx.dailyTokenCounter.updateMany({
                        where: {
                            id: counter.id,

                            /*
                            | Only update if this
                            | counter is still the
                            | current version.
                            */
                            nextToken:
                                tokenNumber,
                        },

                        data: {
                            nextToken:
                                tokenNumber + 1,
                        },
                    });


                if (
                    updateResult.count !== 1
                ) {
                    const error =
                        new Error(
                            "Unable to assign token number. Please try again."
                        );

                    error.code =
                        "TOKEN_ASSIGNMENT_FAILED";

                    throw error;
                }
            }


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

                        visitDate:
                            new Date(),

                        visitType:
                            computedVisitType,

                        revisitCount,

                        status:
                            "REGISTERED",

                        patientId,

                        departmentId,

                        doctorId,

                        createdBy:
                            userId,

                        genderAtVisit:
                            patient.gender,

                        opFee,

                        discountAmount,

                        finalFee,
                    },

                    include: {
                        patient: {
                            include: {
                                scheme: true,
                            },
                        },

                        department: true,

                        doctor: true,
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

                        doctor: true,
                    },
                });


                return {
                    visit:
                        updatedVisit,

                    tokenNumber,
                };
            },
            {
                isolationLevel:
                    "Serializable",
            }
        );
    } catch (error) {
        if (error.code === "P2002") {
            const duplicateError = new Error(
                "Patient has already registered an OP visit with this doctor today."
            );
            duplicateError.code = "DUPLICATE_SAME_DAY_VISIT";
            throw duplicateError;
        }

        throw error;
    }
}




/*
|--------------------------------------------------------------------------
| Today's Token
|--------------------------------------------------------------------------
*/

async function getTodayTokenRecord() {
    const today =
        getStartOfToday();

    const counter =
        await prisma.dailyTokenCounter.findUnique({
            where: {
                tokenDate: today,
            },
        });

    if (!counter) {
        return {
            currentToken: 0,
            nextToken: 1,
        };
    }

    return {
        currentToken:
            counter.nextToken - 1,

        nextToken:
            counter.nextToken,
    };
}


/*
|--------------------------------------------------------------------------
| Set Today's Starting Token
|--------------------------------------------------------------------------
*/

async function setTodayTokenRecord(
    startingToken
) {
    const token =
        Number(startingToken);

    if (
        !Number.isInteger(token) ||
        token < 1 ||
        token > 99999
    ) {
        const error =
            new Error(
                "Starting token must be a whole number between 1 and 99999"
            );

        error.code =
            "TOKEN_VALIDATION_ERROR";

        throw error;
    }


    const today =
        getStartOfToday();

    const tomorrow =
        getTomorrow();


    const existingVisits =
        await prisma.patientVisit.count({
            where: {
                visitDate: {
                    gte: today,
                    lt: tomorrow,
                },

                status: {
                    not: "CANCELLED",
                },
            },
        });


    if (existingVisits > 0) {
        const error =
            new Error(
                "Today's starting token cannot be changed after OP registration has started."
            );

        error.code =
            "TOKEN_ALREADY_STARTED";

        throw error;
    }


    const counter =
        await prisma.dailyTokenCounter.upsert({
            where: {
                tokenDate: today,
            },

            update: {
                nextToken:
                    token,
            },

            create: {
                tokenDate:
                    today,

                nextToken:
                    token,
            },
        });


    return {
        currentToken:
            counter.nextToken - 1,

        nextToken:
            counter.nextToken,
    };
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
                doctor: true,
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

module.exports = {
    registerVisitRecord,
    getPatientDoctorVisitHistory,
    getTodayTokenRecord,
    setTodayTokenRecord,
    getTodayVisitRecords,
};
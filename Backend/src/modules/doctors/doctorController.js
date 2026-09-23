const { z } = require("zod");
const { prisma } = require("../../config/prisma");

const doctorSchema = z.object({
    employeeCode: z.string().trim().max(30, "Employee code cannot exceed 30 characters").optional().or(z.literal("")),
    fullName: z.string().trim().min(2, "Doctor name must contain at least 2 characters").max(100, "Doctor name cannot exceed 100 characters"),
    specialization: z.string().trim().max(100, "Specialization cannot exceed 100 characters").optional().or(z.literal("")),
    departmentId: z.coerce.number().int().positive("Please select a department"),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// ==========================================
// GET ALL DOCTORS
// ==========================================

const getDoctors = async (req, res) => {
    try {
        const doctors = await prisma.doctor.findMany({
            orderBy: {
                fullName: "asc",
            },
            include: {
                department: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });

        res.status(200).json({
            success: true,
            doctors,
        });

    } catch (error) {
        console.error("Get doctors error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch doctors",
        });
    }
};


// ==========================================
// CREATE DOCTOR
// ==========================================

const createDoctor = async (req, res) => {
    try {
        const result = doctorSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                code: "DOCTOR_VALIDATION_ERROR",
                message: result.error.issues[0].message,
            });
        }

        const employeeCode =result.data.employeeCode?.trim() || null;
        const fullName = result.data.fullName.trim();
        const specialization =result.data.specialization?.trim() || null;
        const departmentId =Number(result.data.departmentId);
        const status =result.data.status || "ACTIVE";

        // ==========================================
        // CHECK DEPARTMENT
        // ==========================================

        const department = await prisma.department.findUnique({
            where: {
                id: departmentId,
            },
        });

        if (!department) {
            return res.status(400).json({
                success: false,
                code: "DEPARTMENT_NOT_FOUND",
                message: "Selected department does not exist",
            });
        }

        // ==========================================
        // CHECK EMPLOYEE CODE
        // ==========================================

        if (employeeCode) {
            const existingEmployeeCode = await prisma.doctor.findFirst({
                    where: {
                        employeeCode: {
                            equals: employeeCode,
                            mode: "insensitive",
                        },
                    },
                });

            if (existingEmployeeCode) {
                return res.status(409).json({
                    success: false,
                    code: "DOCTOR_DUPLICATE_EMPLOYEE_CODE",
                    message: "Doctor employee code already exists",
                });
            }
        }

        // ==========================================
        // CHECK DUPLICATE DOCTOR
        //
        // Same:
        // fullName
        // specialization
        // department
        //
        // = duplicate
        // ==========================================

        const duplicateDoctor =await prisma.doctor.findFirst({
                where: {
                    fullName: {
                        equals: fullName,
                        mode: "insensitive",
                    },
                    departmentId,
                    specialization: specialization
                        ? {
                            equals: specialization,
                            mode: "insensitive",
                        }
                        : null,
                },
            });

        if (duplicateDoctor) {
            return res.status(409).json({
                success: false,
                code: "DOCTOR_DUPLICATE",
                message:
                    "A doctor with the same name, specialization and department already exists",
            });
        }

        // ==========================================
        // CREATE
        // ==========================================

        const doctor = await prisma.doctor.create({
            data: {
                employeeCode,
                fullName,
                specialization,
                departmentId,
                status,
            },
            include: {
                department: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });

        res.status(201).json({
            success: true,
            message: "Doctor created successfully",
            doctor,
        });

    } catch (error) {
        console.error("Create doctor error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                code: "DOCTOR_DUPLICATE",
                message: "Doctor already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create doctor",
        });
    }
};

// ==========================================
// UPDATE DOCTOR
// ==========================================

const updateDoctor = async (req, res) => {
    try {
        const doctorId = Number(req.params.id);

        if (!Number.isInteger(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid doctor ID",
            });
        }

        const result = doctorSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                code: "DOCTOR_VALIDATION_ERROR",
                message: result.error.issues[0].message,
            });
        }

        const employeeCode =result.data.employeeCode?.trim() || null;
        const fullName =result.data.fullName.trim();
        const specialization =result.data.specialization?.trim() || null;
        const departmentId =Number(result.data.departmentId);
        const status =result.data.status || "ACTIVE";

        // ==========================================
        // FIND DOCTOR
        // ==========================================

        const existingDoctor =await prisma.doctor.findUnique({
                where: {
                    id: doctorId,
                },
            });

        if (!existingDoctor) {
            return res.status(404).json({
                success: false,
                code: "DOCTOR_NOT_FOUND",
                message: "Doctor not found",
            });
        }

        // ==========================================
        // CHECK DEPARTMENT
        // ==========================================

        const department =await prisma.department.findUnique({
                where: {
                    id: departmentId,
                },
            });

        if (!department) {
            return res.status(400).json({
                success: false,
                code: "DEPARTMENT_NOT_FOUND",
                message: "Selected department does not exist",
            });
        }


        // ==========================================
        // CHECK EMPLOYEE CODE
        // ==========================================

        if (employeeCode) {
            const duplicateEmployeeCode =await prisma.doctor.findFirst({
                    where: {
                        employeeCode: {
                            equals: employeeCode,
                            mode: "insensitive",
                        },
                        NOT: {
                            id: doctorId,
                        },
                    },
                });

            if (duplicateEmployeeCode) {
                return res.status(409).json({
                    success: false,
                    code: "DOCTOR_DUPLICATE_EMPLOYEE_CODE",
                    message:"Another doctor already uses this employee code",
                });
            }
        }

        // ==========================================
        // CHECK DUPLICATE DOCTOR
        // EXCLUDING CURRENT DOCTOR
        // ==========================================

        const duplicateDoctor =await prisma.doctor.findFirst({
                where: {
                    fullName: {
                        equals: fullName,
                        mode: "insensitive",
                    },
                    departmentId,
                    specialization: specialization
                        ? {
                            equals: specialization,
                            mode: "insensitive",
                        }
                        : null,

                    NOT: {
                        id: doctorId,
                    },
                },
            });

        if (duplicateDoctor) {
            return res.status(409).json({
                success: false,
                code: "DOCTOR_DUPLICATE",
                message:"Another doctor with the same name, specialization and department already exists",
            });
        }


        // ==========================================
        // UPDATE
        // ==========================================

        const doctor = await prisma.doctor.update({
                where: {
                    id: doctorId,
                },
                data: {
                    employeeCode,
                    fullName,
                    specialization,
                    departmentId,
                    status,
                },
                include: {
                    department: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
            });

        res.status(200).json({
            success: true,
            message: "Doctor updated successfully",
            doctor,
        });

    } catch (error) {
        console.error("Update doctor error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                code: "DOCTOR_DUPLICATE",
                message: "Doctor already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update doctor",
        });
    }
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getDoctors,
    createDoctor,
    updateDoctor,
};
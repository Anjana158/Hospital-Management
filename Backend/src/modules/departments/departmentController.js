const { z } = require("zod");
const { prisma } = require("../../config/prisma");

const departmentSchema = z.object({
    code: z.string().trim().min(2, "Department code must contain at least 2 characters").max(20, "Department code cannot exceed 20 characters"),
    name: z.string().trim().min(2, "Department name must contain at least 2 characters").max(100, "Department name cannot exceed 100 characters"),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});


// ==========================================
// GET ALL DEPARTMENTS
// ==========================================

const getDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: {
                name: "asc",
            },
            include: {
                _count: {
                    select: {
                        doctors: true,
                    },
                },
            },
        });

        res.status(200).json({
            success: true,
            departments,
        });
    } catch (error) {
        console.error("Get departments error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch departments",
        });
    }
};


// ==========================================
// CREATE DEPARTMENT
// ==========================================

const createDepartment = async (req, res) => {
    try {
        const result = departmentSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                code: "DEPARTMENT_VALIDATION_ERROR",
                message: result.error.issues[0].message,
            });
        }
        const code = result.data.code.trim();
        const name = result.data.name.trim();
        const status = result.data.status || "ACTIVE";

        // Check duplicate code
        const existingCode = await prisma.department.findFirst({
            where: {
                code: {
                    equals: code,
                    mode: "insensitive",
                },
            },
        });

        if (existingCode) {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE_CODE",
                message: "Department code already exists",
            });
        }

        // Check duplicate name
        const existingName = await prisma.department.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: "insensitive",
                },
            },
        });

        if (existingName) {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE_NAME",
                message: "Department name already exists",
            });
        }

        const department = await prisma.department.create({
            data: {
                code,
                name,
                status,
            },
        });

        res.status(201).json({
            success: true,
            message: "Department created successfully",
            department,
        });

    } catch (error) {
        console.error("Create department error:", error);

        // Prisma unique constraint fallback
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE",
                message: "Department code or name already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create department",
        });
    }
};


// ==========================================
// UPDATE DEPARTMENT
// ==========================================

const updateDepartment = async (req, res) => {
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isInteger(departmentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid department ID",
            });
        }

        const result = departmentSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                code: "DEPARTMENT_VALIDATION_ERROR",
                message: result.error.issues[0].message,
            });
        }

        const code = result.data.code.trim();
        const name = result.data.name.trim();
        const status = result.data.status || "ACTIVE";


        const existingDepartment = await prisma.department.findUnique({
            where: {
                id: departmentId,
            },
        });

        if (!existingDepartment) {
            return res.status(404).json({
                success: false,
                code: "DEPARTMENT_NOT_FOUND",
                message: "Department not found",
            });
        }


        // Check duplicate code excluding current department
        const duplicateCode = await prisma.department.findFirst({
            where: {
                code: {
                    equals: code,
                    mode: "insensitive",
                },
                NOT: {
                    id: departmentId,
                },
            },
        });

        if (duplicateCode) {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE_CODE",
                message: "Another department already uses this code",
            });
        }


        // Check duplicate name excluding current department
        const duplicateName = await prisma.department.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: "insensitive",
                },
                NOT: {
                    id: departmentId,
                },
            },
        });

        if (duplicateName) {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE_NAME",
                message: "Another department already uses this name",
            });
        }


        const department = await prisma.department.update({
            where: {
                id: departmentId,
            },
            data: {
                code,
                name,
                status,
            },
        });

        res.status(200).json({
            success: true,
            message: "Department updated successfully",
            department,
        });

    } catch (error) {
        console.error("Update department error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                code: "DEPARTMENT_DUPLICATE",
                message: "Department code or name already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update department",
        });
    }
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getDepartments,
    createDepartment,
    updateDepartment,
};
const {
    registerVisitRecord,
    getPatientDepartmentVisitHistory,
    getTodayVisitRecords,
    getPatientVisitRecord,
    getPatientVisitHistory,
} = require("./visitService");


/*
|--------------------------------------------------------------------------
| Register OP Visit
|--------------------------------------------------------------------------
*/

async function registerVisit(req, res) {
    try {
        const result =
            await registerVisitRecord(
                req.body,
                req.user.userId
            );

        return res.status(201).json({
            success: true,

            message:
                "OP visit registered successfully",

            data: result,
        });

    } catch (error) {

        console.error(
            "Register OP visit error:",
            error
        );


        const knownErrors = [
            "PATIENT_NOT_FOUND",
            "PATIENT_INACTIVE",
            "DEPARTMENT_NOT_FOUND",
            "DEPARTMENT_INACTIVE",
            "REVISIT_NOT_FOUND",
            "TOKEN_ASSIGNMENT_FAILED",
            "DUPLICATE_SAME_DAY_VISIT",
            "PAYMENT_METHOD_REQUIRED",
            "VISIT_SCHEME_INELIGIBLE",
            "VISIT_SCHEME_SELECTION_REQUIRED",
            "SCHEME_VALIDATION_ERROR",
            "SCHEME_FIELD_VALIDATION_ERROR",
        ];


        let statusCode = 500;


        if (
            error.name ===
            "ZodError"
        ) {
            statusCode = 400;
        } else if (
            error.code ===
            "DUPLICATE_SAME_DAY_VISIT"
        ) {
            statusCode = 409;
        } else if (
            knownErrors.includes(
                error.code
            )
        ) {
            statusCode = 400;
        }


        return res.status(statusCode).json({
            success: false,

            message:
                error.name ===
                "ZodError"
                    ? error.issues
                        .map(
                            (issue) =>
                                issue.message
                        )
                        .join(", ")
                    : error.message ||
                      "Failed to register OP visit",
        });
    }
}


/*
|--------------------------------------------------------------------------
| Today's OP Visits
|--------------------------------------------------------------------------
*/

async function getPatientDepartmentHistory(req, res) {
    try {
        const data = await getPatientDepartmentVisitHistory(
            req.params.patientId,
            req.params.departmentId
        );

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get patient-department visit history error:", error);

        const knownErrors = [
            "PATIENT_NOT_FOUND",
            "DEPARTMENT_NOT_FOUND",
            "PATIENT_HISTORY_VALIDATION_ERROR",
            "DEPARTMENT_HISTORY_VALIDATION_ERROR",
        ];

        const statusCode =
            error.name === "ZodError"
                ? 400
                : knownErrors.includes(error.code)
                    ? 400
                    : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to load patient visit history",
        });
    }
}

async function getTodayVisits(req, res) {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const results = await getTodayVisitRecords(page, limit);

        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("Get today's visits error:", error);

        return res.status(error.code === "VISIT_TODAY_VALIDATION_ERROR" ? 400 : 500).json({
            success: false,
            message: error.message,
        });
    }
}

async function getVisit(req, res) {
    try {
        const data = await getPatientVisitRecord(req.params.id);

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        const statusCode = error.code === "VISIT_NOT_FOUND"
            ? 404
            : error.code === "VISIT_VALIDATION_ERROR"
                ? 400
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to load OP visit",
        });
    }
}

async function getPatientVisits(req, res) {
    try {
        const data = await getPatientVisitHistory(req.params.patientId);

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        const statusCode = error.code === "PATIENT_NOT_FOUND"
            ? 404
            : error.code === "PATIENT_HISTORY_VALIDATION_ERROR"
                ? 400
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to load patient OP visit history",
        });
    }
}

module.exports = {
    registerVisit,
    getPatientDepartmentHistory,
    getTodayVisits,
    getVisit,
    getPatientVisits,
};
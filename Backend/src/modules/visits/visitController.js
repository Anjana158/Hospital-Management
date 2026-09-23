const {
    registerVisitRecord,
    getPatientDoctorVisitHistory,
    getTodayTokenRecord,
    setTodayTokenRecord,
    getTodayVisitRecords,
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
            "DOCTOR_NOT_FOUND",
            "DOCTOR_INACTIVE",
            "DOCTOR_DEPARTMENT_MISMATCH",
            "REVISIT_NOT_FOUND",
            "TOKEN_ASSIGNMENT_FAILED",
            "DUPLICATE_SAME_DAY_VISIT",
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

async function getPatientDoctorHistory(req, res) {
    try {
        const data = await getPatientDoctorVisitHistory(
            req.params.patientId,
            req.params.doctorId
        );

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get patient-doctor visit history error:", error);

        const knownErrors = [
            "PATIENT_NOT_FOUND",
            "DOCTOR_NOT_FOUND",
            "PATIENT_HISTORY_VALIDATION_ERROR",
            "DOCTOR_HISTORY_VALIDATION_ERROR",
        ];

        const statusCode =
            error.name === "ZodError"
                ? 400
                : knownErrors.includes(error.code)
                    ? 400
                    : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to load patient-doctor visit history",
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

/*
|--------------------------------------------------------------------------
| Today's Token
|--------------------------------------------------------------------------
*/

async function getTodayToken(
    req,
    res
) {
    try {
        const data =
            await getTodayTokenRecord();

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {

        console.error(
            "Get today's token error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to load today's token",
        });
    }
}


/*
|--------------------------------------------------------------------------
| Set Today's Token
|--------------------------------------------------------------------------
*/

async function setTodayToken(
    req,
    res
) {
    try {
        const data =
            await setTodayTokenRecord(
                req.body.startingToken
            );

        return res.status(200).json({
            success: true,

            message:
                "Today's starting token updated successfully",

            data,
        });

    } catch (error) {

        console.error(
            "Set today's token error:",
            error
        );


        let statusCode = 500;


        if (
            error.code ===
                "TOKEN_VALIDATION_ERROR"
        ) {
            statusCode = 400;
        }

        if (
            error.code ===
                "TOKEN_ALREADY_STARTED"
        ) {
            statusCode = 409;
        }


        return res.status(statusCode).json({
            success: false,
            message:
                error.message ||
                "Failed to update today's token",
        });
    }
}


module.exports = {
    registerVisit,
    getPatientDoctorHistory,
    getTodayVisits,
    getTodayToken,
    setTodayToken,
};
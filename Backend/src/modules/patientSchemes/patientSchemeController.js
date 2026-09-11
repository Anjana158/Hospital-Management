const {
    getRequestRole,
    listPatientSchemes,
    createPatientScheme,
    updatePatientScheme,
} = require("./patientSchemeService");

function errorStatus(error) {
    if (error.name === "ZodError") {
        return 400;
    }

    if (error.code === "SCHEME_VALIDATION_ERROR") {
        return 400;
    }

    if (error.code === "SCHEME_DUPLICATE") {
        return 409;
    }

    if (error.code === "SCHEME_NOT_FOUND") {
        return 404;
    }

    return 500;
}

function errorMessage(error) {
    if (error.name === "ZodError") {
        return error.issues.map((issue) => issue.message).join(", ");
    }

    return error.message;
}

async function getPatientSchemes(req, res) {
    try {
        const schemes = await listPatientSchemes(getRequestRole(req.user));

        return res.status(200).json({
            success: true,
            data: schemes,
        });
    } catch (error) {
        console.error("Get patient schemes error:", error);

        return res.status(errorStatus(error)).json({
            success: false,
            message: "Failed to load patient schemes",
        });
    }
}

async function addPatientScheme(req, res) {
    try {
        const scheme = await createPatientScheme(req.body);

        return res.status(201).json({
            success: true,
            message: "Patient scheme created successfully",
            data: scheme,
        });
    } catch (error) {
        console.error("Create patient scheme error:", error);

        return res.status(errorStatus(error)).json({
            success: false,
            message: errorMessage(error),
        });
    }
}

async function editPatientScheme(req, res) {
    try {
        const scheme = await updatePatientScheme(req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Patient scheme updated successfully",
            data: scheme,
        });
    } catch (error) {
        console.error("Update patient scheme error:", error);

        return res.status(errorStatus(error)).json({
            success: false,
            message: errorMessage(error),
        });
    }
}

module.exports = {
    getPatientSchemes,
    addPatientScheme,
    editPatientScheme,
};
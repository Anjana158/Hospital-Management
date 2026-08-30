const {
    getRequestRole,
    listPatientCategories,
    createPatientCategory,
    updatePatientCategory,
} = require("./patientCategoryService");

function errorStatus(error) {
    if (error.name === "ZodError") {
        return 400;
    }

    if (error.code === "CATEGORY_VALIDATION_ERROR") {
        return 400;
    }

    if (error.code === "CATEGORY_DUPLICATE") {
        return 409;
    }

    if (error.code === "CATEGORY_NOT_FOUND") {
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

async function getPatientCategories(req, res) {
    try {
        const categories = await listPatientCategories(getRequestRole(req.user));

        return res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error("Get patient categories error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load patient categories",
        });
    }
}

async function addPatientCategory(req, res) {
    try {
        const category = await createPatientCategory(req.body);

        return res.status(201).json({
            success: true,
            message: "Patient category created successfully",
            data: category,
        });
    } catch (error) {
        console.error("Create patient category error:", error);

        return res.status(errorStatus(error)).json({
            success: false,
            message: errorMessage(error),
        });
    }
}

async function editPatientCategory(req, res) {
    try {
        const category = await updatePatientCategory(req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Patient category updated successfully",
            data: category,
        });
    } catch (error) {
        console.error("Update patient category error:", error);

        return res.status(errorStatus(error)).json({
            success: false,
            message: errorMessage(error),
        });
    }
}

module.exports = {
    getPatientCategories,
    addPatientCategory,
    editPatientCategory,
};

const {
    registerPatientRecord,
    searchPatients: searchPatientRecords,
    getPatientDetails: getPatientDetailsRecord,
    updatePatientRecord: updatePatientRecordService,
} = require("./patientService");

async function getPatientDetails(req, res) {
    try {
        const lookupType = req.params.uhid ? "uhid" : "id";
        const identifier = req.params.uhid || req.params.id;
        const patient = await getPatientDetailsRecord(identifier, lookupType);

        return res.status(200).json({
            success: true,
            data: patient,
        });
    } catch (error) {
        console.error("Get patient details error:", error);

        const statusCode = error.code === "PATIENT_NOT_FOUND"
            ? 404
            : error.code === "PATIENT_DETAILS_VALIDATION_ERROR"
                ? 400
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
}

async function searchPatients(req, res) {
    try {
        const results = await searchPatientRecords(req.query);

        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("Search patients error:", error);

        return res.status(error.name === "ZodError" || error.code === "PATIENT_SEARCH_VALIDATION_ERROR" ? 400 : 500).json({
            success: false,
            message: error.name === "ZodError"
                ? error.issues.map((issue) => issue.message).join(", ")
                : error.message,
        });
    }
}

async function registerPatient(req, res) {
    try {
        const patient = await registerPatientRecord(
            req.body,
            req.user.userId
        );

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully",
            data: patient,
        });
    } catch (error) {
        console.error("Register patient error:", error);

        const statusCode = error.name === "ZodError" || error.code === "PATIENT_VALIDATION_ERROR"
            ? 400
            : error.code === "PATIENT_DUPLICATE_PHONE"
                ? 409
                : 500;

        const response = {
            success: false,
            message: error.name === "ZodError"
                ? error.issues.map((issue) => issue.message).join(", ")
                : error.message,
        };

        if (error.code === "PATIENT_DUPLICATE_PHONE") {
            response.code = error.code;
            response.duplicates = error.duplicates;
        }

        return res.status(statusCode).json(response);
    }
}

async function updatePatient(req, res) {
    try {
        const patient = await updatePatientRecordService(req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Patient updated successfully",
            data: patient,
        });
    } catch (error) {
        console.error("Update patient error:", error);

        const statusCode = error.name === "ZodError"
            ? 400
            : error.code === "PATIENT_NOT_FOUND"
                ? 404
                : error.code === "PATIENT_UPDATE_VALIDATION_ERROR"
                    ? 400
                    : error.code === "PATIENT_DUPLICATE_PHONE"
                        ? 409
                        : 500;

        const response = {
            success: false,
            message: error.name === "ZodError"
                ? error.issues.map((issue) => issue.message).join(", ")
                : error.message,
        };

        if (error.code === "PATIENT_DUPLICATE_PHONE") {
            response.code = error.code;
            response.duplicates = error.duplicates;
        }

        return res.status(statusCode).json(response);
    }
}

module.exports = {
    registerPatient,
    searchPatients,
    getPatientDetails,
    updatePatient,
};
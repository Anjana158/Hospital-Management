const billing = require("./billingService");
const { registerPatientRecord } = require("../patients/patientService");

function statusFor(error) {
    if (
        error.name === "ZodError" ||
        ["SCHEME_VALIDATION_ERROR", "SCHEME_FIELD_VALIDATION_ERROR"].includes(error.code) ||
        String(error.code || "").startsWith("BILLING_")
    ) {
        if ([
            "BILLING_PATIENT_NOT_FOUND",
            "BILLING_SERVICE_NOT_FOUND",
            "BILLING_SCHEME_INACTIVE",
            "BILLING_BILL_NOT_FOUND",
            "BILLING_PAYMENT_NOT_FOUND",
        ].includes(error.code)) return 404;
        if ([
            "BILLING_DUPLICATE_SERVICE",
            "BILLING_PAYMENT_REVERSED",
            "BILLING_IDEMPOTENCY_CONFLICT",
        ].includes(error.code)) return 409;
        return 400;
    }
    if (error.code === "P2002") return 409;
    if (error.code === "P2034") return 409;
    return 500;
}

async function handle(res, operation) {
    try {
        const data = await operation();
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Billing request failed:", error);
        return res.status(statusFor(error)).json({
            success: false,
            message: error.name === "ZodError"
                ? error.issues.map((issue) => issue.message).join(", ")
                : error.message || "Billing request failed",
        });
    }
}

function listServices(req, res) {
    return handle(res, () => billing.listServices(String(req.user.role).toUpperCase() === "ADMIN"));
}

function createService(req, res) {
    return handle(res, () => billing.createService(req.body, req.user.userId));
}

function updateService(req, res) {
    return handle(res, () => billing.updateService(req.params.id, req.body, req.user.userId));
}

function searchPatients(req, res) {
    return handle(res, () => billing.searchBillingPatients(req.query.q));
}

async function registerPatient(req, res) {
    try {
        const patient = await registerPatientRecord(req.body, req.user.userId);
        return res.status(201).json({
            success: true,
            message: "Patient registered successfully",
            data: patient,
        });
    } catch (error) {
        console.error("Billing patient registration failed:", error);
        const statusCode = error.name === "ZodError" || [
            "PATIENT_VALIDATION_ERROR",
            "SCHEME_VALIDATION_ERROR",
            "SCHEME_FIELD_VALIDATION_ERROR",
        ].includes(error.code) ? 400
            : error.code === "PATIENT_DUPLICATE_PHONE" ? 409 : 500;
        const response = {
            success: false,
            message: error.name === "ZodError"
                ? error.issues.map((issue) => issue.message).join(", ")
                : error.message || "Patient registration failed",
        };
        if (error.code === "PATIENT_DUPLICATE_PHONE") {
            response.code = error.code;
            response.duplicates = error.duplicates;
        }
        return res.status(statusCode).json(response);
    }
}

function listPatientRegistrationSchemes(req, res) {
    return handle(res, billing.listPatientRegistrationSchemes);
}

function createBill(req, res) {
    return handle(res, () => billing.createBill(req.body, req.user.userId));
}

function quoteBill(req, res) {
    return handle(res, () => billing.quoteBill(req.body));
}

function getBill(req, res) {
    return handle(res, () => billing.readBill({ billNumber: req.params.billNumber }));
}

function reversePayment(req, res) {
    return handle(res, () => billing.reversePayment(req.params.paymentId, req.user.userId, req.body?.reason));
}

function getReport(req, res) {
    return handle(res, () => billing.getReport(req.query, req.user.role, req.user.userId));
}

function listBillingStaff(req, res) {
    return handle(res, billing.listBillingStaff);
}

module.exports = {
    createBill,
    createService,
    getBill,
    getReport,
    listBillingStaff,
    listPatientRegistrationSchemes,
    listServices,
    reversePayment,
    quoteBill,
    registerPatient,
    searchPatients,
    updateService,
};

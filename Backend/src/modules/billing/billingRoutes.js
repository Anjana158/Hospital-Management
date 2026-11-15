const express = require("express");

const {
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
} = require("./billingController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();
const billingRoles = ["BILLING", "ADMIN"];

router.use(authenticateToken);
router.get("/services", requireRole(...billingRoles), listServices);
router.post("/services", requireRole("ADMIN"), createService);
router.patch("/services/:id", requireRole("ADMIN"), updateService);
router.get("/patients", requireRole(...billingRoles), searchPatients);
router.get("/patients/schemes", requireRole(...billingRoles), listPatientRegistrationSchemes);
router.post("/patients", requireRole(...billingRoles), registerPatient);
router.get("/reports/staff", requireRole("ADMIN"), listBillingStaff);
router.get("/reports", requireRole(...billingRoles), getReport);
router.post("/bills/quote", requireRole(...billingRoles), quoteBill);
router.post("/bills", requireRole(...billingRoles), createBill);
router.get("/bills/:billNumber", requireRole(...billingRoles), getBill);
router.post("/payments/:paymentId/reverse", requireRole("ADMIN"), reversePayment);

module.exports = router;

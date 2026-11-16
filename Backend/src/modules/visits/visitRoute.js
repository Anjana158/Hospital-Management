const express = require("express");

const {
    registerVisit,
    getPatientDepartmentHistory,
    getTodayVisits,
    getVisit,
    getPatientVisits,
} = require("./visitController");

const {authenticateToken,} = require("../../middleware/authMiddleware");
const {requireRole,} = require("../../middleware/roleMiddleware");

const router = express.Router();


/*
|--------------------------------------------------------------------------
| Reception Authentication
|--------------------------------------------------------------------------
*/

router.use(authenticateToken,requireRole("RECEPTION"));

/*
|--------------------------------------------------------------------------
| OP Registration
|--------------------------------------------------------------------------
*/

router.post("/",registerVisit);

router.get("/patient/:patientId/department/:departmentId/history", getPatientDepartmentHistory);
router.get("/patient/:patientId/history", getPatientVisits);

/*
|--------------------------------------------------------------------------
| Today's OP Visits
|--------------------------------------------------------------------------
*/

router.get("/today", getTodayVisits);
router.get("/:id", getVisit);

module.exports = router;
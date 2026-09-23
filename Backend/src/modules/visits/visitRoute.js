const express = require("express");

const {
    registerVisit,
    getPatientDoctorHistory,
    getTodayVisits,
    getTodayToken,
    setTodayToken,
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

router.get("/patient/:patientId/doctor/:doctorId/history", getPatientDoctorHistory);

/*
|--------------------------------------------------------------------------
| Today's OP Visits
|--------------------------------------------------------------------------
*/

router.get("/today", getTodayVisits);

/*
|--------------------------------------------------------------------------
| Today's Token
|--------------------------------------------------------------------------
*/

router.get("/token/today",getTodayToken);


/*
|--------------------------------------------------------------------------
| Set Today's Starting Token
|--------------------------------------------------------------------------
*/

router.put("/token/today", setTodayToken);


module.exports = router;
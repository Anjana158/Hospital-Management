const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')

dotenv.config()

const { connectPrisma } = require("./src/config/prisma");

const authRoutes = require("./src/modules/auth/authRoutes");
const userRoutes = require("./src/modules/users/userRoutes");
const dashboardRoutes = require("./src/modules/dashboard/dashboardRoutes");
const patientRoutes = require("./src/modules/patients/patientRoutes");
const patientSchemeRoutes = require("./src/modules/patientSchemes/patientSchemeRoutes");
const departmentRoutes = require("./src/modules/departments/departmentRoutes");
const visitRoutes = require("./src/modules/visits/visitRoute");
const reportRoutes = require("./src/modules/reports/reportsRoutes");
const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: [
        'http://100.103.223.11',
        'http://100.103.223.11:5173',
        'http://localhost:5173'
    ],
    credentials: true,
}))

app.use("/api/auth",authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/dashboard",dashboardRoutes);
app.use("/api/patients",patientRoutes);
app.use("/api/schemes",patientSchemeRoutes);
app.use("/api/departments",departmentRoutes);
app.use("/api/visits",visitRoutes);
app.use("/api/reports",reportRoutes);


const PORT = process.env.PORT || 5000

async function startServer() {
    await connectPrisma();

    app.listen(PORT,'0.0.0.0',()=>{
        console.log(`server is running on ${PORT}`)
    });
}

startServer();
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')
const path = require('path')

const envFile = process.env.ENV_FILE
if (envFile) {
    const loaded = dotenv.config({
        path: path.resolve(__dirname, envFile),
        override: true,
    })
    if (loaded.error) {
        console.error(`Cannot load ENV_FILE (${envFile}). The default .env was not used.`)
        process.exit(1)
    }
    let databaseName = ''
    try {
        databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1)
    } catch {
        databaseName = ''
    }
    if (databaseName !== 'hospital_management_loadtest' || String(process.env.PORT) === '5000') {
        console.error('Refusing to start. ENV_FILE must select hospital_management_loadtest on a port other than 5000.')
        process.exit(1)
    }
} else {
    dotenv.config()
}

const { connectPrisma } = require("./src/config/prisma");

const authRoutes = require("./src/modules/auth/authRoutes");
const userRoutes = require("./src/modules/users/userRoutes");
const dashboardRoutes = require("./src/modules/dashboard/dashboardRoutes");
const patientRoutes = require("./src/modules/patients/patientRoutes");
const patientSchemeRoutes = require("./src/modules/patientSchemes/patientSchemeRoutes");
const departmentRoutes = require("./src/modules/departments/departmentRoutes");
const visitRoutes = require("./src/modules/visits/visitRoute");
const reportRoutes = require("./src/modules/reports/reportsRoutes");
const billingRoutes = require("./src/modules/billing/billingRoutes");
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
app.use("/api/billing",billingRoutes);


const PORT = process.env.PORT || 5000

async function startServer() {
    await connectPrisma();

    app.listen(PORT,'0.0.0.0',()=>{
        console.log(`server is running on ${PORT}`)
    });
}

startServer();
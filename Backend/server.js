const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const { connectPrisma } = require("./src/config/prisma");

const authRoutes = require("./src/modules/auth/authRoutes");
const userRoutes = require("./src/modules/users/userRoutes");
const dashboardRoutes = require("./src/modules/dashboard/dashboardRoutes");
const patientRoutes = require("./src/modules/patients/patientRoutes");
const patientSchemeRoutes = require("./src/modules/patientSchemes/patientSchemeRoutes");
const departmentRoutes = require("./src/modules/departments/departmentRoutes");
const doctorRoutes = require("./src/modules/doctors/doctorRoutes");
const visitRoutes = require("./src/modules/visits/visitRoute");
const app = express()

app.use(express.json())
app.use(cors())

app.use("/api/auth",authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/dashboard",dashboardRoutes);
app.use("/api/patients",patientRoutes);
app.use("/api/schemes",patientSchemeRoutes);
app.use("/api/departments",departmentRoutes);
app.use("/api/doctors",doctorRoutes);
app.use("/api/visits",visitRoutes);


const PORT = process.env.PORT || 5000

async function startServer() {
    await connectPrisma();

    app.listen(PORT,()=>{
        console.log(`server is running on ${PORT}`)
    });
}

startServer();
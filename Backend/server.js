const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const { connectPrisma } = require("./src/config/prisma");

const authRoutes = require("./src/modules/auth/authRoutes");
const userRoutes = require("./src/modules/users/userRoutes");
const dashboardRoutes = require("./src/modules/dashboard/dashboardRoutes");

const app = express()

app.use(express.json())
app.use(cors())

app.use("/api/auth",authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/dashboard",dashboardRoutes);

const PORT = process.env.PORT || 5000

async function startServer() {
    await connectPrisma();

    app.listen(PORT,()=>{
        console.log(`server is running on ${PORT}`)
    });
}

startServer();
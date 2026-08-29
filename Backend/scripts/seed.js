const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    console.log("Starting database seed...");

    // 1. Create the default roles
    const adminRole = await prisma.role.upsert({
        where: {
            name: "ADMIN",
        },
        update: {},
        create: {
            name: "ADMIN",
            description: "System Administrator",
        },
    });

    const receptionRole = await prisma.role.upsert({
        where: {
            name: "RECEPTION",
        },
        update: {},
        create: {
            name: "RECEPTION",
            description: "Reception Staff",
        },
    });

    const billingRole = await prisma.role.upsert({
        where: {
            name: "BILLING",
        },
        update: {},
        create: {
            name: "BILLING",
            description: "Billing Staff",
        },
    });

    console.log("Roles created successfully");

    // 2. Hash the admin password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // 3. Create the default admin user
    const admin = await prisma.user.upsert({
        where: {
            username: "admin",
        },
        update: {},
        create: {
            employeeId: "EMP001",
            fullName: "System Administrator",
            username: "admin",
            password: hashedPassword,
            roleId: adminRole.id,
        },
    });

    console.log("Admin created successfully");
    console.log("Username:", admin.username);
    console.log("Employee ID:", admin.employeeId);
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
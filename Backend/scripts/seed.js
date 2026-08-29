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

    // 4. Create the default patient category
    await prisma.patientCategory.upsert({
        where: {
            code: "GENERAL",
        },
        update: {},
        create: {
            code: "GENERAL",
            name: "General",
            discountEligible: false,
        },
    });

    // 5. Create basic departments and doctors
    const generalMedicine = await prisma.department.upsert({
        where: {
            code: "GM",
        },
        update: {},
        create: {
            code: "GM",
            name: "General Medicine",
        },
    });

    const pediatrics = await prisma.department.upsert({
        where: {
            code: "PED",
        },
        update: {},
        create: {
            code: "PED",
            name: "Pediatrics",
        },
    });

    await prisma.doctor.upsert({
        where: {
            employeeCode: "DOC001",
        },
        update: {},
        create: {
            employeeCode: "DOC001",
            fullName: "Dr. Arun Kumar",
            specialization: "General Medicine",
            departmentId: generalMedicine.id,
        },
    });

    await prisma.doctor.upsert({
        where: {
            employeeCode: "DOC002",
        },
        update: {},
        create: {
            employeeCode: "DOC002",
            fullName: "Dr. Priya Sharma",
            specialization: "Pediatrics",
            departmentId: pediatrics.id,
        },
    });

    console.log("Reception reference data created successfully");
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
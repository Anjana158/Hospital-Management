const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function connectPrisma() {
    try{
        await prisma.$connect();
        console.log("PostgreSQL connected successfully");
    }catch(error){
        console.error("PostgreSQL connection failed");
        console.error(error);
        process.exit(1);
    }
}

module.exports = { 
    prisma, 
    connectPrisma, 
};
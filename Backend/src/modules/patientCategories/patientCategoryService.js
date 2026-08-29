const { prisma } = require("../../config/prisma");

async function listActivePatientCategories() {
    return prisma.patientCategory.findMany({
        where: {
            status: "ACTIVE",
        },
        select: {
            id: true,
            code: true,
            name: true,
            discountEligible: true,
        },
        orderBy: {
            name: "asc",
        },
    });
}

module.exports = {
    listActivePatientCategories,
};

const { listActivePatientCategories } = require("./patientCategoryService");

async function getPatientCategories(req, res) {
    try {
        const categories = await listActivePatientCategories();

        return res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error("Get patient categories error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load patient categories",
        });
    }
}

module.exports = {
    getPatientCategories,
};

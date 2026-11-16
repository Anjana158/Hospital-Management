const { generateReceptionistReport, generateAdminReceptionReport } = require("./reportService");

async function getReceptionistReport(req, res) {
    try {
        const report = await generateReceptionistReport(req.query, req.user.userId);

        return res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error("Get receptionist report error:", error);

        const statusCode =
            error.code === "REPORT_VALIDATION_ERROR" ||
            error.code === "REPORT_RANGE_ERROR"
                ? 400
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to generate receptionist report",
        });
    }
}

async function getAdminReceptionReport(req, res) {
    try {
        const report = await generateAdminReceptionReport(req.query);

        return res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error("Get admin reception report error:", error);

        const statusCode =
            error.code === "REPORT_VALIDATION_ERROR" ||
            error.code === "REPORT_RANGE_ERROR"
                ? 400
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to generate admin reception report",
        });
    }
}

module.exports = {
    getReceptionistReport,
    getAdminReceptionReport,
};

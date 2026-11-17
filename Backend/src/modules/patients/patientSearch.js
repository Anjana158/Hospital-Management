function buildPatientSearchFilter(query, field) {
    const normalizedQuery = String(query || "").replace(/\D/g, "");
    const searchConditions = [];

    if (field === "uhid" || field === "all") {
        searchConditions.push({
            uhid: {
                contains: query,
                mode: "insensitive",
            },
        });
    }

    if (field === "name" || field === "all") {
        searchConditions.push({
            firstName: { contains: query, mode: "insensitive" },
        });
    }

    if (field === "phone" || (field === "all" && normalizedQuery.length >= 3)) {
        if (normalizedQuery.length < 3) {
            const error = new Error("Phone search must contain at least 3 digits");
            error.code = "PATIENT_SEARCH_VALIDATION_ERROR";
            throw error;
        }

        searchConditions.push(
            { phone: { contains: normalizedQuery } },
            { alternatePhone: { contains: normalizedQuery } }
        );
    }

    if (searchConditions.length === 0) {
        const error = new Error("Search conditions are required");
        error.code = "PATIENT_SEARCH_VALIDATION_ERROR";
        throw error;
    }

    return { OR: searchConditions };
}

module.exports = { buildPatientSearchFilter };

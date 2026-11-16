import axios from "axios";

const API_URL = "/api/reports/admin";

export const getAdminReceptionReport = async (params = {}) => {
    const response = await axios.get(API_URL, {
        params,
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
    });

    return response.data;
};
import axios from "axios";

const API_URL = "http://100.103.223.11:5000/api/reports/admin";

export const getAdminReceptionReport = async (params = {}) => {
    const response = await axios.get(API_URL, {
        params,
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
    });

    return response.data;
};
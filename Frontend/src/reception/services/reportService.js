import axios from "axios";

const API_URL = "/api/reports";

const getAuthConfig = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
});

export const getReceptionistReport = async (params = {}) => {
    const response = await axios.get(`${API_URL}/receptionist`, {
        params,
        ...getAuthConfig(),
    });

    return response.data;
};

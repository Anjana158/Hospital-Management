import axios from "axios";

const API_URL = "http://100.103.223.11:5000/api/reports";

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

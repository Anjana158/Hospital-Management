import axios from "axios";

const API_URL = "http://localhost:5000/api/schemes";

const getAuthConfig = () => {
    const token = localStorage.getItem("token");

    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

export const getSchemes = async () => {
    const response = await axios.get(
        API_URL,
        getAuthConfig()
    );

    return response.data;
};

export const createScheme = async (schemeData) => {
    const response = await axios.post(
        API_URL,
        schemeData,
        getAuthConfig()
    );

    return response.data;
};

export const updateScheme = async (id, schemeData) => {
    const response = await axios.patch(
        `${API_URL}/${id}`,
        schemeData,
        getAuthConfig()
    );

    return response.data;
};
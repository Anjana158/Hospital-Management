import axios from "axios";

const API_URL = "http://localhost:5000/api/patient-categories";

const getAuthConfig = () => {
    const token = localStorage.getItem("token");

    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

export const getPatientCategories = async () => {
    const response = await axios.get(API_URL, getAuthConfig());
    return response.data;
};

export const createPatientCategory = async (categoryData) => {
    const response = await axios.post(
        API_URL,
        categoryData,
        getAuthConfig()
    );

    return response.data;
};

export const updatePatientCategory = async (id, categoryData) => {
    const response = await axios.patch(
        `${API_URL}/${id}`,
        categoryData,
        getAuthConfig()
    );

    return response.data;
};

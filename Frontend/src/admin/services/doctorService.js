import axios from "axios";

const API_URL = "http://localhost:5000/api/doctors";

const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

export const getDoctors = async () => {
    const response = await axios.get(
        API_URL,getAuthConfig()
    );
    return response.data;
};

export const createDoctor = async (data) => {
    const response = await axios.post(
        API_URL,data,getAuthConfig()
    );
    return response.data;
};


export const updateDoctor = async (id, data) => {
    const response = await axios.put(
        `${API_URL}/${id}`,data,getAuthConfig()
    );

    return response.data;
};
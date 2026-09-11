import axios from "axios";

const API_URL = "http://localhost:5000/api/patients";
const SCHEMES_API_URL = "http://localhost:5000/api/schemes";

const getAuthConfig = () => {
    const token = localStorage.getItem("token");

    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

// ========================================
// GET TODAY'S PATIENTS
// ========================================

export const getTodayPatients = async (
    page = 1,
    limit = 20
) => {
    const response = await axios.get(
        `${API_URL}/today`,
        {
            params: {
                page,
                limit,
            },
            ...getAuthConfig(),
        }
    );

    return response.data;
};

// ========================================
// SEARCH PATIENTS
// ========================================

export const searchPatients = async (
    query,
    field = "all",
    page = 1,
    limit = 20
) => {
    const response = await axios.get(
        `${API_URL}/search`,
        {
            params: { q: query, field, page, limit },
            ...getAuthConfig(),
        }
    );

    return response.data;
};



// ========================================
// GET PATIENT BY ID
// ========================================

export const getPatientById = async (id) => {
    const response = await axios.get(
        `${API_URL}/${id}`,
        getAuthConfig()
    );

    return response.data;
};

// ========================================
// GET PATIENT BY UHID
// ========================================

export const getPatientByUhid = async (uhid) => {
    const response = await axios.get(
        `${API_URL}/uhid/${uhid}`,
        getAuthConfig()
    );

    return response.data;
};

// ========================================
// REGISTER PATIENT
// ========================================

export const registerPatient = async (patientData) => {
    const response = await axios.post(
        API_URL,
        patientData,
        getAuthConfig()
    );

    return response.data;
};

// ========================================
// UPDATE PATIENT
// ========================================

export const updatePatient = async (id, patientData) => {
    const response = await axios.patch(
        `${API_URL}/${id}`,
        patientData,
        getAuthConfig()
    );

    return response.data;
};

// ========================================
// GET SCHEMES
// ========================================

export const getPatientSchemes = async () => {
    const response = await axios.get(
        SCHEMES_API_URL,
        getAuthConfig()
    );

    return response.data;
};
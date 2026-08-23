import axios from "axios";

const API_URL = "http://localhost:5000/api/users";


const getAuthConfig = () => {
    const token = localStorage.getItem("token");

    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};


// ========================================
// GET USERS
// ========================================

export const getUsers = async (roleId = "") => {

    const url = roleId
        ? `${API_URL}?roleId=${roleId}`
        : API_URL;

    const response = await axios.get(
        url,
        getAuthConfig()
    );

    return response.data;
};


// ========================================
// GET ROLES
// ========================================

export const getRoles = async () => {

    const response = await axios.get(
        `${API_URL}/roles`,
        getAuthConfig()
    );

    return response.data;
};


// ========================================
// CREATE USER
// ========================================

export const createUser = async (userData) => {

    const response = await axios.post(
        API_URL,
        userData,
        getAuthConfig()
    );

    return response.data;
};


// ========================================
// UPDATE USER
// ========================================

export const updateUser = async (
    id,
    userData
) => {

    const response = await axios.put(
        `${API_URL}/${id}`,
        userData,
        getAuthConfig()
    );

    return response.data;
};


// ========================================
// CHANGE USER STATUS
// ========================================

export const changeUserStatus= async (id,status) => {

    const response = await axios.patch(
        `${API_URL}/${id}/status`,
        {status,},
        getAuthConfig()
    );

    return response.data;
};
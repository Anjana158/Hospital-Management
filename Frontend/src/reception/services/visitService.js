import axios from "axios";

const API_URL =
    "http://100.103.223.11:5000/api/visits";


const getAuthConfig = () => {
    const token =
        localStorage.getItem("token");

    return {
        headers: {
            Authorization:
                `Bearer ${token}`,
        },
    };
};


/*
|--------------------------------------------------------------------------
| Register OP Visit
|--------------------------------------------------------------------------
*/

export const registerVisit =
    async (visitData) => {

        const response =
            await axios.post(
                API_URL,
                visitData,
                getAuthConfig()
            );

        return response.data;
    };

/*
|--------------------------------------------------------------------------
| Get Patient-Department Visit History
|--------------------------------------------------------------------------
*/

export const getPatientDepartmentVisitHistory = async (patientId, departmentId) => {
    const response = await axios.get(
        `${API_URL}/patient/${patientId}/department/${departmentId}/history`,
        getAuthConfig()
    );

    return response.data;
};

/*
|--------------------------------------------------------------------------
| Get Today's OP Visits
|--------------------------------------------------------------------------
*/

export const getTodayVisits = async (
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

export const getVisitById = async (visitId) => {
    const response = await axios.get(
        `${API_URL}/${visitId}`,
        getAuthConfig()
    );

    return response.data;
};

export const getPatientVisitHistory = async (patientId) => {
    const response = await axios.get(
        `${API_URL}/patient/${patientId}/history`,
        getAuthConfig()
    );

    return response.data;
};

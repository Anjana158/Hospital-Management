import axios from "axios";

const API_URL =
    "http://localhost:5000/api/visits";


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
| Get Patient-Doctor Visit History
|--------------------------------------------------------------------------
*/

export const getPatientDoctorVisitHistory = async (patientId, doctorId) => {
    const response = await axios.get(
        `${API_URL}/patient/${patientId}/doctor/${doctorId}/history`,
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

/*
|--------------------------------------------------------------------------
| Get Today's Token
|--------------------------------------------------------------------------
*/

export const getTodayToken =
    async () => {

        const response =
            await axios.get(
                `${API_URL}/token/today`,
                getAuthConfig()
            );

        return response.data;
    };


/*
|--------------------------------------------------------------------------
| Set Today's Starting Token
|--------------------------------------------------------------------------
*/

export const setTodayToken =
    async (startingToken) => {

        const response =
            await axios.put(
                `${API_URL}/token/today`,
                {
                    startingToken,
                },
                getAuthConfig()
            );

        return response.data;
    };
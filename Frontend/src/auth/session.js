import axios from "axios";

const REFRESH_URL = "/api/auth/refresh";
const LOGOUT_URL = "/api/auth/logout";
const REFRESH_BEFORE_MS = 60 * 1000;

let refreshPromise = null;
let refreshFailed = false;
let refreshTimer = null;
let installed = false;

function readExpiry(token) {
    try {
        const payload = token.split(".")[1];
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(atob(normalized));
        return typeof decoded.exp === "number" ? decoded.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

function clearLocalSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("tokenExpiresAt");
}

function scheduleRefresh(token) {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    const expiresAt = readExpiry(token);
    if (!expiresAt) {
        return;
    }

    localStorage.setItem("tokenExpiresAt", String(expiresAt));
    const delay = Math.max(expiresAt - Date.now() - REFRESH_BEFORE_MS, 0);

    refreshTimer = setTimeout(() => {
        refreshAccessToken().catch(() => {
            forceLogout();
        });
    }, delay);
}

export function saveAccessToken(token) {
    refreshFailed = false;
    localStorage.setItem("token", token);
    scheduleRefresh(token);
}

async function performRefresh() {
    const response = await fetch(REFRESH_URL, {
        method: "POST",
        credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.data?.token) {
        throw new Error(data.message || "Session expired");
    }

    return data.data.token;
}

export function refreshAccessToken() {
    if (refreshFailed) {
        return Promise.reject(new Error("Session expired"));
    }

    if (!refreshPromise) {
        refreshPromise = performRefresh()
            .then((token) => {
                saveAccessToken(token);
                return token;
            })
            .catch((error) => {
                refreshFailed = true;
                if (refreshTimer) {
                    clearTimeout(refreshTimer);
                    refreshTimer = null;
                }
                throw error;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

export function forceLogout() {
    refreshFailed = true;
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    clearLocalSession();

    if (window.location.pathname !== "/") {
        window.location.assign("/");
    }
}

export async function logout() {
    refreshFailed = true;
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    try {
        await fetch(LOGOUT_URL, {
            method: "POST",
            credentials: "include",
            keepalive: true,
        });
    } catch {
        // Local session is cleared even if the server is unreachable.
    }

    clearLocalSession();
    refreshFailed = false;
}

function authorizationHeader(headers) {
    if (!headers) {
        return "";
    }

    if (typeof Headers !== "undefined" && headers instanceof Headers) {
        return headers.get("Authorization") || headers.get("authorization") || "";
    }

    return headers.Authorization || headers.authorization || "";
}

function installFetchRefresh() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const isSessionCall = url.includes("/api/auth/refresh")
            || url.includes("/api/auth/login")
            || url.includes("/api/auth/logout");

        const response = await originalFetch(input, init);
        const hasAccessToken = authorizationHeader(init.headers).startsWith("Bearer ");

        if (response.status !== 401 || !hasAccessToken || isSessionCall || init._authRetry) {
            return response;
        }

        try {
            const token = await refreshAccessToken();
            const headers = new Headers(init.headers || {});
            headers.set("Authorization", `Bearer ${token}`);
            return originalFetch(input, {
                ...init,
                headers,
                _authRetry: true,
            });
        } catch {
            forceLogout();
            return response;
        }
    };
}

function installAxiosRefresh() {
    axios.interceptors.request.use((config) => {
        const token = localStorage.getItem("token");
        const current = config.headers?.Authorization || config.headers?.authorization;

        if (token && typeof current === "string" && current.startsWith("Bearer ")) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    });

    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const original = error.config;
            const url = original?.url || "";
            const isSessionCall = url.includes("/api/auth/refresh")
                || url.includes("/api/auth/login")
                || url.includes("/api/auth/logout");

            if (error.response?.status !== 401 || !original || original._authRetry || isSessionCall) {
                return Promise.reject(error);
            }

            original._authRetry = true;

            try {
                const token = await refreshAccessToken();
                original.headers.Authorization = `Bearer ${token}`;
                return axios(original);
            } catch (refreshError) {
                forceLogout();
                return Promise.reject(refreshError);
            }
        }
    );
}

export function installAuthRefresh() {
    if (installed) {
        return;
    }

    installed = true;
    installAxiosRefresh();
    installFetchRefresh();

    const token = localStorage.getItem("token");
    if (token) {
        scheduleRefresh(token);
    }
}

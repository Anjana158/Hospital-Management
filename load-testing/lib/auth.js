import http from "k6/http";
import { check } from "k6";
import { baseUrl } from "./config.js";

function jsonHeaders(token) {
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

export function login(account) {
    const root = baseUrl();
    const roles = http.get(
        `${root}/api/auth/roles?username=${encodeURIComponent(account.username)}`,
        { tags: { flow: "auth" } }
    );
    check(roles, {
        "role lookup returned 200": (response) => response.status === 200,
    });

    const response = http.post(
        `${root}/api/auth/login`,
        JSON.stringify({
            username: account.username,
            password: account.password,
            role: account.role,
        }),
        { headers: jsonHeaders(), tags: { flow: "auth" } }
    );
    const accepted = check(response, {
        "login returned 200": (result) => result.status === 200,
    });
    if (!accepted) {
        throw new Error(`Login failed for ${account.username} with status ${response.status}`);
    }

    const body = response.json();
    if (!body || !body.data || !body.data.token) {
        throw new Error(`Login response for ${account.username} did not include an access token`);
    }

    return {
        token: body.data.token,
        username: account.username,
        role: account.role,
        issuedAt: Date.now(),
    };
}

export function refresh(session) {
    const response = http.post(`${baseUrl()}/api/auth/refresh`, null, {
        headers: jsonHeaders(session.token),
        tags: { flow: "auth" },
    });
    const accepted = check(response, {
        "refresh returned 200": (result) => result.status === 200,
    });
    if (!accepted) {
        return login(session);
    }
    const body = response.json();
    return {
        token: body.data.token,
        username: session.username,
        role: session.role,
        password: session.password,
        issuedAt: Date.now(),
    };
}

export function authParams(session, flow, extra) {
    return Object.assign(
        {
            headers: jsonHeaders(session.token),
            tags: { flow },
        },
        extra || {}
    );
}

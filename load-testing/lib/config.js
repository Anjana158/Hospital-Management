// Shared by k6 scenarios and the Node seed. No k6 or Node built-ins.

export const ALLOWED_DATABASE = "hospital_management_loadtest";
export const POC_DATABASE = "hospital_management";
export const POC_API_PORT = "5000";
export const DEFAULT_BASE_URL = "http://127.0.0.1:5001";

const DATABASE_URL_PATTERN =
    /^postgres(?:ql)?:\/\/([^:@/]+):([^@/]+)@([A-Za-z0-9.]+):(\d+)\/([A-Za-z0-9_]+)(\?.*)?$/;

function readEnv(name) {
    if (typeof __ENV !== "undefined" && __ENV[name]) {
        return __ENV[name];
    }
    if (typeof process !== "undefined" && process.env && process.env[name]) {
        return process.env[name];
    }
    return "";
}

export function assertSafeBaseUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`BASE_URL is not a valid URL: ${value}`);
    }

    const host = url.hostname;
    if (url.protocol !== "http:" || (host !== "127.0.0.1" && host !== "localhost")) {
        throw new Error("BASE_URL must be http://127.0.0.1 or http://localhost");
    }
    if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
        throw new Error("BASE_URL must be only a loopback origin, with no path, query, or credentials");
    }
    const port = url.port || "80";
    if (port === POC_API_PORT) {
        throw new Error("Refusing port 5000. That port is the POC API and its database must stay untouched.");
    }
    return url.origin;
}

export function assertSafeDatabaseUrl(value) {
    if (!value || value.includes(" ") || value.includes("\n")) {
        throw new Error("TEST_DATABASE_URL is missing or malformed");
    }
    const match = value.match(DATABASE_URL_PATTERN);
    if (!match) {
        throw new Error(
            "TEST_DATABASE_URL must look like postgresql://USER:PASSWORD@127.0.0.1:PORT/hospital_management_loadtest"
        );
    }

    const [, user, password, host, port, database] = match;
    if (host !== "127.0.0.1" && host !== "localhost") {
        throw new Error(`Refusing database host ${host}. Only loopback is allowed.`);
    }
    if (database === POC_DATABASE) {
        throw new Error("Refusing the POC database hospital_management.");
    }
    if (database !== ALLOWED_DATABASE) {
        throw new Error(`Refusing database ${database}. The only allowed name is ${ALLOWED_DATABASE}.`);
    }
    if (!user || !password || !port) {
        throw new Error("TEST_DATABASE_URL is missing a user, password, or port");
    }

    return {
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        host,
        port,
        database,
        url: value,
    };
}

export function baseUrl() {
    return assertSafeBaseUrl(readEnv("BASE_URL") || DEFAULT_BASE_URL);
}

export function testDatabaseUrl() {
    const configured = readEnv("TEST_DATABASE_URL");
    if (!configured) {
        throw new Error("TEST_DATABASE_URL is required");
    }
    return assertSafeDatabaseUrl(configured);
}

export function todayIso() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

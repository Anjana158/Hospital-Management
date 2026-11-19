import http from "k6/http";
import { authParams } from "../lib/auth.js";
import { baseUrl } from "../lib/config.js";
import { adminDesk, billingDesk, receptionDesk } from "../lib/flows.js";

const root = baseUrl();

export const options = {
    scenarios: {
        reception: { executor: "constant-vus", vus: 5, duration: "5m", exec: "reception" },
        billing: { executor: "constant-vus", vus: 3, duration: "5m", exec: "billing" },
        admin: { executor: "constant-vus", vus: 2, duration: "5m", exec: "admin" },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
    },
};

export function reception() {
    receptionDesk({ thinkMin: 3, thinkMax: 8 });
}

export function billing() {
    billingDesk({ thinkMin: 3, thinkMax: 8 });
}

export function admin() {
    const session = adminDesk({ thinkMin: 3, thinkMax: 8 });
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    http.get(
        `${root}/api/reports/admin?period=monthly&month=${month}&year=${year}`,
        authParams(session, "report")
    );
    http.get(
        `${root}/api/billing/reports?period=monthly&month=${month}&year=${year}`,
        authParams(session, "report")
    );
}

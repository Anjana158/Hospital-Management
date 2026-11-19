import { baseUrl } from "../lib/config.js";
import { adminDesk, billingDesk, receptionDesk } from "../lib/flows.js";

baseUrl();

export const options = {
    scenarios: {
        reception: { executor: "constant-vus", vus: 8, duration: "10m", exec: "reception" },
        billing: { executor: "constant-vus", vus: 4, duration: "10m", exec: "billing" },
        admin: { executor: "constant-vus", vus: 2, duration: "10m", exec: "admin" },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
        "http_req_duration{flow:read}": ["p(95)<500"],
        "http_req_duration{flow:write}": ["p(95)<800"],
        "http_req_duration{flow:report}": ["p(95)<1500"],
    },
};

export function reception() {
    receptionDesk({ thinkMin: 8, thinkMax: 20 });
}

export function billing() {
    billingDesk({ thinkMin: 8, thinkMax: 20 });
}

export function admin() {
    adminDesk({ thinkMin: 8, thinkMax: 20 });
}

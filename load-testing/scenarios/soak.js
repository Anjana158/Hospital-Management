import { baseUrl } from "../lib/config.js";
import { adminDesk, billingDesk, receptionDesk } from "../lib/flows.js";

baseUrl();

let receptionSession;
let billingSession;
let adminSession;

export const options = {
    scenarios: {
        reception: { executor: "constant-vus", vus: 8, duration: "2h", exec: "reception" },
        billing: { executor: "constant-vus", vus: 4, duration: "2h", exec: "billing" },
        admin: { executor: "constant-vus", vus: 2, duration: "2h", exec: "admin" },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
    },
};

export function reception() {
    receptionSession = receptionDesk({ session: receptionSession, thinkMin: 8, thinkMax: 20 });
}

export function billing() {
    billingSession = billingDesk({ session: billingSession, thinkMin: 8, thinkMax: 20 });
}

export function admin() {
    adminSession = adminDesk({ session: adminSession, thinkMin: 8, thinkMax: 20 });
}

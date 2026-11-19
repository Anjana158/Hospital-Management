import { baseUrl } from "../lib/config.js";
import { adminDesk, billingDesk, receptionDesk } from "../lib/flows.js";

baseUrl();

export const options = {
    vus: 1,
    iterations: 1,
    thresholds: {
        http_req_failed: ["rate<0.01"],
        checks: ["rate>0.95"],
    },
};

export default function () {
    receptionDesk({ think: false, uniquePatient: true });
    billingDesk({ think: false });
    adminDesk({ think: false });
}

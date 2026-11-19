import { baseUrl } from "../lib/config.js";
import { adminDesk, billingDesk, receptionDesk } from "../lib/flows.js";

baseUrl();

export const options = {
    scenarios: {
        load: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "2m", target: 15 },
                { duration: "3m", target: 30 },
                { duration: "3m", target: 45 },
                { duration: "3m", target: 60 },
                { duration: "2m", target: 0 },
            ],
            exec: "mixed",
        },
    },
    thresholds: {
        http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" }],
        http_req_duration: [{ threshold: "p(95)<5000", abortOnFail: true, delayAbortEval: "30s" }],
    },
};

export function mixed() {
    const lane = __VU % 14;
    const options = { thinkMin: 1, thinkMax: 3 };
    if (lane < 8) {
        receptionDesk(options);
    } else if (lane < 12) {
        billingDesk(options);
    } else {
        adminDesk(options);
    }
}

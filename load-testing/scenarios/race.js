import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { baseUrl } from "../lib/config.js";
import { authParams, login } from "../lib/auth.js";
import { account, catalogIds } from "../lib/flows.js";

const visitCreated = new Counter("race_visit_created");
const visitConflict = new Counter("race_visit_conflict");
const visitOther = new Counter("race_visit_other");
const billOk = new Counter("race_bill_ok");
const billConflict = new Counter("race_bill_conflict");
const billOther = new Counter("race_bill_other");

baseUrl();

export const options = {
    vus: 1,
    iterations: 1,
};

function tally(responses, created, conflict, other) {
    for (const response of responses) {
        if (response.status === 201 || response.status === 200) {
            created.add(1);
        } else if (response.status === 409) {
            conflict.add(1);
        } else {
            other.add(1);
        }
    }
}

export default function () {
    const root = baseUrl();
    const ids = catalogIds();
    const reception = login(account("reception"));
    const created = http.post(
        `${root}/api/patients`,
        JSON.stringify({
            firstName: "LOADTEST",
            lastName: `Race${Date.now()}`,
            age: 41,
            gender: "FEMALE",
            phone: `993${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
            city: "LOADTEST",
            addressLine1: "LOADTEST synthetic record",
        }),
        authParams(reception, "write")
    );
    check(created, { "race patient returned 201": (response) => response.status === 201 });
    const patientId = created.json().data.id;
    const visitBody = JSON.stringify({
        patientId,
        departmentId: ids.departmentId,
        opFee: 10,
        paymentMethod: "CASH",
    });
    const visitParams = authParams(reception, "write", {
        responseCallback: http.expectedStatuses(201, 409),
    });
    const visits = http.batch(
        Array.from({ length: 30 }, () => ["POST", `${root}/api/visits`, visitBody, visitParams])
    );
    tally(visits, visitCreated, visitConflict, visitOther);

    const billing = login(account("billing"));
    const billBody = JSON.stringify({
        patientId: ids.samplePatientId,
        category: "APL",
        items: [{ serviceId: ids.serviceId, quantity: 1 }],
        paymentMethod: "CASH",
        idempotencyKey: `lt-race-${Date.now()}`,
    });
    const billParams = authParams(billing, "write", {
        responseCallback: http.expectedStatuses(200, 409),
    });
    const bills = http.batch(
        Array.from({ length: 30 }, () => ["POST", `${root}/api/billing/bills`, billBody, billParams])
    );
    tally(bills, billOk, billConflict, billOther);
    check(bills, {
        "at least one bill response was received": (responses) => responses.length === 30,
    });
}

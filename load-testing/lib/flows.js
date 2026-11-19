import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, todayIso } from "./config.js";
import { authParams, login, refresh } from "./auth.js";

const catalog = JSON.parse(open("../data/users.json"));

export function account(role) {
    const pool = catalog[role];
    if (!pool || pool.length === 0) {
        throw new Error(`data/users.json has no ${role} accounts. Run node data/seed.js before k6.`);
    }
    const selected = pool[(__VU - 1) % pool.length];
    return {
        username: selected.username,
        password: catalog.password,
        role: role === "reception" ? "RECEPTION" : role === "billing" ? "BILLING" : "ADMIN",
    };
}

function pause(options) {
    if (!options || options.think === false) {
        return;
    }
    const min = options.thinkMin == null ? 8 : options.thinkMin;
    const max = options.thinkMax == null ? 20 : options.thinkMax;
    sleep(min + Math.random() * (max - min));
}

function bodyOf(response) {
    try {
        return response.json();
    } catch {
        return null;
    }
}

function phoneNumber() {
    const suffix = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
    return `991${suffix}`;
}

export function sessionFor(role, existing) {
    if (!existing) {
        const created = login(account(role));
        created.password = catalog.password;
        return created;
    }
    if (Date.now() - existing.issuedAt < 12 * 60 * 1000) {
        return existing;
    }
    return refresh(existing);
}

export function receptionDesk(options) {
    const session = sessionFor("reception", options && options.session);
    const root = baseUrl();
    const date = todayIso();

    const search = http.get(
        `${root}/api/patients/search?q=LOADTEST&field=name&page=1&limit=20`,
        authParams(session, "read")
    );
    check(search, { "patient search returned 200": (response) => response.status === 200 });

    const found = bodyOf(search);
    const existingPatient = found && found.data && found.data.items && found.data.items[0];

    let patient = existingPatient;
    if (!patient || (options && options.uniquePatient)) {
        const created = http.post(
            `${root}/api/patients`,
            JSON.stringify({
                firstName: "LOADTEST",
                lastName: `Case${__VU}x${__ITER}`,
                age: 34,
                gender: "MALE",
                phone: phoneNumber(),
                city: "LOADTEST",
                addressLine1: "LOADTEST synthetic record",
            }),
            authParams(session, "write")
        );
        const registered = check(created, {
            "patient registration returned 201": (response) => response.status === 201,
        });
        if (registered) {
            patient = bodyOf(created).data;
        }
    }

    http.get(`${root}/api/patients/today?page=1&limit=20`, authParams(session, "read"));
    http.get(`${root}/api/schemes`, authParams(session, "read"));
    const departments = http.get(`${root}/api/departments`, authParams(session, "read"));
    check(departments, { "departments returned 200": (response) => response.status === 200 });

    const departmentList = bodyOf(departments);
    const department = departmentList && departmentList.departments && departmentList.departments[0];
    if (patient && patient.id && department && department.id) {
        http.get(`${root}/api/patients/${patient.id}`, authParams(session, "read"));
        http.get(`${root}/api/patients/uhid/${encodeURIComponent(patient.uhid)}`, authParams(session, "read"));
        const visit = http.post(
            `${root}/api/visits`,
            JSON.stringify({
                patientId: patient.id,
                departmentId: department.id,
                opFee: 10,
                paymentMethod: "CASH",
            }),
            authParams(session, "write", {
                responseCallback: http.expectedStatuses(201, 409),
            })
        );
        check(visit, {
            "visit create returned 201 or expected 409": (response) =>
                response.status === 201 || response.status === 409,
        });
        const visitBody = bodyOf(visit);
        const visitId = visitBody && visitBody.data && visitBody.data.visit && visitBody.data.visit.id;
        if (visitId) {
            http.get(`${root}/api/visits/${visitId}`, authParams(session, "read"));
        }
        http.get(`${root}/api/visits/patient/${patient.id}/history`, authParams(session, "read"));
        http.get(
            `${root}/api/visits/patient/${patient.id}/department/${department.id}/history`,
            authParams(session, "read")
        );
    }

    http.get(`${root}/api/visits/today?page=1&limit=20`, authParams(session, "read"));
    http.get(`${root}/api/dashboard/me`, authParams(session, "read"));
    http.get(
        `${root}/api/reports/receptionist?period=daily&date=${date}`,
        authParams(session, "report")
    );
    pause(options);
    return session;
}

export function billingDesk(options) {
    const session = sessionFor("billing", options && options.session);
    const root = baseUrl();
    const date = todayIso();

    http.get(`${root}/api/dashboard/me`, authParams(session, "read"));
    const patients = http.get(
        `${root}/api/billing/patients?q=LOADTEST`,
        authParams(session, "read")
    );
    check(patients, { "billing patient search returned 200": (response) => response.status === 200 });
    const services = http.get(`${root}/api/billing/services`, authParams(session, "read"));
    check(services, { "billing catalog returned 200": (response) => response.status === 200 });
    http.get(`${root}/api/billing/patients/schemes`, authParams(session, "read"));

    const patientList = (bodyOf(patients) || {}).data || [];
    const serviceList = (bodyOf(services) || {}).data || [];
    const patient = patientList[0];
    const service = serviceList[0];
    if (patient && service) {
        const items = [{ serviceId: service.id, quantity: 1 }];
        http.post(
            `${root}/api/billing/bills/quote`,
            JSON.stringify({ patientId: patient.id, category: "APL", items }),
            authParams(session, "read")
        );
        const bill = http.post(
            `${root}/api/billing/bills`,
            JSON.stringify({
                patientId: patient.id,
                category: "APL",
                items,
                paymentMethod: "CASH",
                idempotencyKey: `lt-${__VU}-${__ITER}-${Date.now()}`,
            }),
            authParams(session, "write")
        );
        const saved = check(bill, { "bill create returned 200": (response) => response.status === 200 });
        const billNumber = saved && bodyOf(bill) && bodyOf(bill).data && bodyOf(bill).data.billNumber;
        if (billNumber) {
            http.get(
                `${root}/api/billing/bills/${encodeURIComponent(billNumber)}`,
                authParams(session, "read")
            );
        }
    }

    http.get(`${root}/api/billing/reports?period=daily&date=${date}`, authParams(session, "report"));
    pause(options);
    return session;
}

export function adminDesk(options) {
    const session = sessionFor("admin", options && options.session);
    const root = baseUrl();
    const date = todayIso();

    http.get(`${root}/api/users`, authParams(session, "read"));
    http.get(`${root}/api/users/roles`, authParams(session, "read"));
    http.get(`${root}/api/departments`, authParams(session, "read"));
    http.get(`${root}/api/schemes`, authParams(session, "read"));
    http.get(`${root}/api/billing/services`, authParams(session, "read"));
    http.get(`${root}/api/billing/reports/staff`, authParams(session, "read"));
    http.get(`${root}/api/billing/reports?period=daily&date=${date}`, authParams(session, "report"));
    http.get(`${root}/api/reports/admin?period=daily&date=${date}`, authParams(session, "report"));
    pause(options);
    return session;
}

export function catalogIds() {
    return {
        departmentId: catalog.departmentId,
        serviceId: catalog.serviceId,
        samplePatientId: catalog.samplePatientId,
    };
}

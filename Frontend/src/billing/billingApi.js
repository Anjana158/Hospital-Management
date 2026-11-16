const API = "/api/billing";

async function request(path, options = {}) {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        const requestError = new Error(result.message || "Billing request failed");
        requestError.status = response.status;
        requestError.code = result.code;
        requestError.duplicates = result.duplicates;
        throw requestError;
    }
    return result.data;
}

export const billingApi = {
    services: () => request("/services"),
    searchPatients: (q) => request(`/patients?q=${encodeURIComponent(q)}`),
    patientSchemes: () => request("/patients/schemes"),
    registerPatient: (payload) => request("/patients", { method: "POST", body: JSON.stringify(payload) }),
    quote: (payload) => request("/bills/quote", { method: "POST", body: JSON.stringify(payload) }),
    createBill: (payload) => request("/bills", { method: "POST", body: JSON.stringify(payload) }),
    bill: (billNumber) => request(`/bills/${encodeURIComponent(billNumber)}`),
    reversePayment: (paymentId, reason) => request(`/payments/${paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    }),
    report: (filters) => request(`/reports?${new URLSearchParams(filters)}`),
    staff: () => request("/reports/staff"),
    adminServices: () => request("/services"),
    createService: (payload) => request("/services", { method: "POST", body: JSON.stringify(payload) }),
    updateService: (id, payload) => request(`/services/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

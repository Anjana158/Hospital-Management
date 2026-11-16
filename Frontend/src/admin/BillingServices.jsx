import { useEffect, useState } from "react";
import { billingApi } from "../billing/billingApi";
import "../styles/Billing.css";
import "../styles/Users.css";
import {
    ADMIN_TABLE_PAGE_SIZE,
    AdminAddButton,
    AdminPagination,
    AdminTableSearch,
} from "./AdminTableControls";

const emptyService = {
    name: "",
    description: "",
    isActive: true,
    aplAmount: "",
    aplFree: false,
    bplAmount: "",
    bplFree: false,
};
function activePrice(service, category) {
    const tariff = service.tariffs.find((row) => row.category === category);
    return tariff || { amount: "", isFree: false };
}

function BillingServices() {
    const [services, setServices] = useState([]);
    const [serviceForm, setServiceForm] = useState(emptyService);
    const [serviceId, setServiceId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(true);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    async function load() {
        setLoading(true);
        try {
            const serviceRows = await billingApi.adminServices();
            setServices(serviceRows);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const filteredServices = services.filter((service) =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const totalPages = Math.max(1, Math.ceil(filteredServices.length / ADMIN_TABLE_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const visibleServices = filteredServices.slice(
        (currentPage - 1) * ADMIN_TABLE_PAGE_SIZE,
        currentPage * ADMIN_TABLE_PAGE_SIZE
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    function openAddService() {
        setServiceId(null);
        setServiceForm(emptyService);
        setError("");
        setNotice("");
        setShowServiceModal(true);
    }

    function editService(service) {
        const apl = activePrice(service, "APL");
        const bpl = activePrice(service, "BPL");
        setServiceId(service.id);
        setServiceForm({
            name: service.name,
            description: service.description || "",
            isActive: service.isActive,
            aplAmount: apl.amount,
            aplFree: apl.isFree,
            bplAmount: bpl.amount,
            bplFree: bpl.isFree,
        });
        setError("");
        setNotice("");
        setShowServiceModal(true);
    }

    function closeServiceModal() {
        setShowServiceModal(false);
        setServiceId(null);
        setServiceForm(emptyService);
        setError("");
    }

    async function submitService(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        try {
            const payload = {
                ...serviceForm,
                aplAmount: Number(serviceForm.aplAmount),
                bplAmount: Number(serviceForm.bplAmount),
            };
            if (serviceId) await billingApi.updateService(serviceId, payload);
            else await billingApi.createService(payload);
            setNotice(serviceId ? "Service updated." : "Service added.");
            setServiceId(null);
            setServiceForm(emptyService);
            setShowServiceModal(false);
            await load();
        } catch (saveError) {
            setError(saveError.message);
        }
    }

    return (
        <div className="admin-page">
            <header className="admin-page-header">
                <h1>Billing Services</h1>
            </header>
            {error && !showServiceModal && <p className="billing-error" role="alert">{error}</p>}
            {notice && <p className="billing-notice" role="status">{notice}</p>}

            <div className="admin-split-toolbar">
                <AdminTableSearch
                    value={searchInput}
                    onChange={setSearchInput}
                    onSearch={() => {
                        setSearchTerm(searchInput.trim());
                        setPage(1);
                    }}
                    onClear={() => {
                        setSearchInput("");
                        setSearchTerm("");
                        setPage(1);
                    }}
                    placeholder="Search billing service name"
                />
                <AdminAddButton type="button" onClick={openAddService}>
                    Add Service
                </AdminAddButton>
            </div>

            <div className="admin-table-container">
                {loading ? (
                    <div className="admin-empty-state">Loading services...</div>
                ) : filteredServices.length === 0 ? (
                    <div className="admin-empty-state">
                        {searchTerm ? "No services match your search." : "No billing services found."}
                    </div>
                ) : (
                    <div className="billing-table-wrap">
                        <table className="admin-data-table">
                            <thead><tr><th>Service</th><th>APL</th><th>BPL</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>{visibleServices.map((service) => {
                                const apl = activePrice(service, "APL");
                                const bpl = activePrice(service, "BPL");
                                return <tr key={service.id}>
                                    <td>{service.name}</td><td>{apl.amount}{apl.isFree ? " (free)" : ""}</td>
                                    <td>{bpl.amount}{bpl.isFree ? " (free)" : ""}</td><td>{service.isActive ? "Active" : "Inactive"}</td>
                                    <td><button className="admin-row-action-button" type="button" onClick={() => editService(service)}>Edit</button></td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>
                )}
            </div>
            {!loading && (
                <AdminPagination
                    page={currentPage}
                    totalItems={filteredServices.length}
                    onPageChange={setPage}
                />
            )}

            {showServiceModal && (
                <div className="user-modal-overlay" onClick={closeServiceModal}>
                    <div
                        className="user-modal billing-service-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="billing-service-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="user-modal-header">
                            <div>
                                <h2 id="billing-service-modal-title">
                                    {serviceId ? "Edit Service" : "Add Service"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Close"
                                onClick={closeServiceModal}
                            >
                                ×
                            </button>
                        </div>
                        <form className="billing-form-grid" onSubmit={submitService}>
                            {error && <p className="billing-error" role="alert">{error}</p>}
                            <label>Service name<input required maxLength="150" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} /></label>
                            <label>Description<input maxLength="500" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} /></label>
                            <label>APL charge<input required type="number" min="0" step="0.01" value={serviceForm.aplAmount} onChange={(e) => setServiceForm({ ...serviceForm, aplAmount: e.target.value })} /></label>
                            <label className="billing-checkbox"><input type="checkbox" checked={serviceForm.aplFree} onChange={(e) => setServiceForm({ ...serviceForm, aplFree: e.target.checked })} /> Explicitly free for APL</label>
                            <label>BPL charge<input required type="number" min="0" step="0.01" value={serviceForm.bplAmount} onChange={(e) => setServiceForm({ ...serviceForm, bplAmount: e.target.value })} /></label>
                            <label className="billing-checkbox"><input type="checkbox" checked={serviceForm.bplFree} onChange={(e) => setServiceForm({ ...serviceForm, bplFree: e.target.checked })} /> Explicitly free for BPL</label>
                            {serviceId && <label className="billing-checkbox"><input type="checkbox" checked={serviceForm.isActive} onChange={(e) => setServiceForm({ ...serviceForm, isActive: e.target.checked })} /> Active for billing</label>}
                            <div className="billing-form-actions">
                                <button className="billing-primary-button" type="submit">
                                    {serviceId ? "Save service" : "Add service"}
                                </button>
                                <button className="billing-secondary-button" type="button" onClick={closeServiceModal}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default BillingServices;

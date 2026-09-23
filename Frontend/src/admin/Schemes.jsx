import { useEffect, useState } from "react";
import {getSchemes, createScheme, updateScheme,} from "./services/schemeService";
import "../styles/Users.css";

const emptyForm = {
    code: "",
    name: "",
    discountType: "NONE",
    discountValue: 0,
    status: "ACTIVE",
};

function Schemes() {
    const [schemes, setSchemes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingScheme, setEditingScheme] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formData, setFormData] = useState(emptyForm);

    const loadSchemes = async () => {
        try {
            setLoading(true);
            setError("");
            const result = await getSchemes();
            setSchemes(result.data || []);
        } catch (loadError) {
            setError(
                loadError.response?.data?.message ||
                "Failed to load schemes"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSchemes();
    }, []);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const openAddModal = () => {
        setEditingScheme(null);
        setFormData(emptyForm);
        setError("");
        setShowModal(true);
    };

    const openEditModal = (scheme) => {
        setEditingScheme(scheme);
        setFormData({
            code: scheme.code,
            name: scheme.name,
            discountType: scheme.discountType || "NONE",
            discountValue: Number(scheme.discountValue || 0),            status: scheme.status,
        });
        setError("");
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingScheme(null);
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            setError("");
            if (editingScheme) {
                await updateScheme(editingScheme.id, {
                    name: formData.name.trim(),
                    discountType: formData.discountType,
                    discountValue:
                        formData.discountType === "NONE"
                            ? 0
                            : Number(formData.discountValue),
                    status: formData.status,
                });
                setSuccess("Scheme updated successfully");
            } else {
                await createScheme({
                    code: formData.code.trim(),
                    name: formData.name.trim(),
                    discountType: formData.discountType,
                    discountValue:
                        formData.discountType === "NONE"
                            ? 0
                            : Number(formData.discountValue),
                });
                setSuccess("Scheme created successfully");
            }
            closeModal();
            await loadSchemes();

        } catch (submitError) {
            setError(
                submitError.response?.data?.message ||
                "Operation failed"
            );
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <p>ADMINISTRATION</p>
                <h1>Schemes</h1>
                <span> Manage schemes available during patient registration.</span>
            </div>

            <div className="users-toolbar"> <div />
                <button className="add-user-btn" onClick={openAddModal}>
                    <span>+</span>
                    Add Scheme
                </button>
            </div>

            {success && (
                <div className="users-error" 
                    style={{
                        borderColor: "#b8dfca",
                        background: "#effaf3",
                        color: "#328254",
                    }}
                >{success}</div>
            )}

            {error && !showModal && (
                <div className="users-error">{error}</div>
            )}

            <div className="users-table-container">
                {loading ? (
                    <div className="users-loading">Loading schemes...</div>
                ) : schemes.length === 0 ? (
                    <div className="users-empty">No schemes found.</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Scheme Code</th>
                                <th>Scheme Name</th>
                                <th>Discount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schemes.map((scheme) => (
                                <tr key={scheme.id}>
                                    <td><strong>{scheme.code}</strong></td>
                                    <td>{scheme.name}</td>
                                    <td>
                                        {scheme.discountType === "PERCENTAGE"
                                            ? `${scheme.discountValue}%`
                                            : scheme.discountType === "FIXED"
                                            ? `₹${scheme.discountValue}`
                                            : "None"}
                                    </td>
                                    <td>
                                        <span className={`status-select ${String(scheme.status).toLowerCase()}`}>
                                            {scheme.status}
                                        </span>
                                    </td>
                                    <td><button className="edit-user-btn" onClick={() => openEditModal(scheme)}>Edit</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="user-modal-overlay" onClick={closeModal}>
                    <div className="user-modal"  onClick={(event) => event.stopPropagation() }>
                        <div className="user-modal-header">
                            <div>
                                <p>ADMINISTRATION</p>
                                <h2>
                                    {editingScheme
                                        ? "Edit Scheme"
                                        : "Add Scheme"}
                                </h2>
                            </div>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label> Scheme Code </label>
                                    <input type="text" name="code" value={formData.code} onChange={handleChange} required={!editingScheme} disabled={Boolean(editingScheme)} placeholder="STAFF" />
                                </div>
                                <div className="form-group">
                                    <label> Scheme Name </label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Discount Type</label>
                                    <select name="discountType" value={formData.discountType}
                                        onChange={handleChange}>
                                        <option value="NONE">No Discount </option>
                                        <option value="PERCENTAGE"> Percentage</option>
                                        <option value="FIXED"> Fixed Amount </option>
                                    </select>
                                </div>

                                {formData.discountType !== "NONE" && (
                                    <div className="form-group">
                                        <label>
                                            {formData.discountType === "PERCENTAGE"
                                                ? "Discount Percentage (%)"
                                                : "Discount Amount (₹)"}
                                        </label>

                                        <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} min="0"
                                            max={
                                                formData.discountType === "PERCENTAGE"
                                                    ? "100"
                                                    : undefined
                                            } step="0.01"required/>
                                    </div>
                                )}

                                {editingScheme && (
                                    <div className="form-group">
                                        <label> Status </label>
                                        <select name="status" value={formData.status} onChange={handleChange}>
                                            <option value="ACTIVE"> ACTIVE </option>
                                            <option value="INACTIVE"> INACTIVE </option>
                                        </select>
                                    </div>
                                )} 
                            </div>

                            {error && (
                                <div className="modal-error">{error} </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={closeModal} >Cancel</button>

                                <button type="submit" className="save-user-btn" >
                                    {editingScheme
                                        ? "Update Scheme"
                                        : "Create Scheme"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Schemes;
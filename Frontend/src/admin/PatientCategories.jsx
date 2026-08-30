import { useEffect, useState } from "react";

import {
    getPatientCategories,
    createPatientCategory,
    updatePatientCategory,
} from "./services/categoryService";

import "../styles/Users.css";

const emptyForm = {
    code: "",
    name: "",
    discountEligible: false,
    status: "ACTIVE",
};

function PatientCategories() {
    const [categories, setCategories] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formData, setFormData] = useState(emptyForm);

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getPatientCategories();
            setCategories(result.data || []);
        } catch (loadError) {
            setError(
                loadError.response?.data?.message ||
                "Failed to load patient categories"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormData(emptyForm);
        setError("");
        setShowModal(true);
    };

    const openEditModal = (category) => {
        setEditingCategory(category);
        setFormData({
            code: category.code,
            name: category.name,
            discountEligible: Boolean(category.discountEligible),
            status: category.status,
        });
        setError("");
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            setError("");

            if (editingCategory) {
                await updatePatientCategory(editingCategory.id, {
                    name: formData.name.trim(),
                    discountEligible: Boolean(formData.discountEligible),
                    status: formData.status,
                });
                setSuccess("Patient category updated successfully");
            } else {
                await createPatientCategory({
                    code: formData.code.trim(),
                    name: formData.name.trim(),
                    discountEligible: Boolean(formData.discountEligible),
                });
                setSuccess("Patient category created successfully");
            }

            closeModal();
            await loadCategories();
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
                <h1>Patient Categories</h1>
                <span>Manage categories available during patient registration.</span>
            </div>

            <div className="users-toolbar">
                <div />
                <button className="add-user-btn" onClick={openAddModal}>
                    <span>+</span>
                    Add Category
                </button>
            </div>

            {success && (
                <div className="users-error" style={{
                    borderColor: "#b8dfca",
                    background: "#effaf3",
                    color: "#328254",
                }}>
                    {success}
                </div>
            )}

            {error && !showModal && (
                <div className="users-error">
                    {error}
                </div>
            )}

            <div className="users-table-container">
                {loading ? (
                    <div className="users-loading">Loading categories...</div>
                ) : categories.length === 0 ? (
                    <div className="users-empty">No patient categories found.</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Category Code</th>
                                <th>Category Name</th>
                                <th>Discount Eligible</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category) => (
                                <tr key={category.id}>
                                    <td>
                                        <strong>{category.code}</strong>
                                    </td>
                                    <td>{category.name}</td>
                                    <td>{category.discountEligible ? "Yes" : "No"}</td>
                                    <td>
                                        <span className={`status-select ${String(category.status).toLowerCase()}`}>
                                            {category.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="edit-user-btn"
                                            onClick={() => openEditModal(category)}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="user-modal-overlay" onClick={closeModal}>
                    <div className="user-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="user-modal-header">
                            <div>
                                <p>ADMINISTRATION</p>
                                <h2>
                                    {editingCategory ? "Edit Category" : "Add Category"}
                                </h2>
                            </div>
                            <button className="modal-close" onClick={closeModal}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Category Code</label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        required={!editingCategory}
                                        disabled={Boolean(editingCategory)}
                                        placeholder="STAFF"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Category Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Discount Eligible</label>
                                    <select
                                        name="discountEligible"
                                        value={formData.discountEligible ? "true" : "false"}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                discountEligible: event.target.value === "true",
                                            }))
                                        }
                                    >
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </div>

                                {editingCategory && (
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            disabled={editingCategory.code === "GENERAL"}
                                        >
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="modal-error">
                                    {error}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="save-user-btn">
                                    {editingCategory ? "Update Category" : "Create Category"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PatientCategories;

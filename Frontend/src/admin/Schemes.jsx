import { useEffect, useState } from "react";
import {getSchemes, createScheme, updateScheme,} from "./services/schemeService";
import "../styles/Users.css";
import {
    ADMIN_TABLE_PAGE_SIZE,
    AdminAddButton,
    AdminPagination,
    AdminTableSearch,
} from "./AdminTableControls";

const emptyForm = {
    code: "",
    name: "",
    eligibilityGender: "NOT_APPLICABLE",
    ageCriteriaType: "NOT_APPLICABLE",
    ageLimit: "",
    minimumAge: "",
    maximumAge: "",
    collectAdditionalInformation: false,
    additionalInformationFields: [],
    status: "ACTIVE",
};

function newAdditionalField(label = "") {
    return {
        key: globalThis.crypto?.randomUUID?.() || `field_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        label,
    };
}

function normalizeSchemeForm(scheme) {
    return {
        ...emptyForm,
        ...scheme,
        eligibilityGender: scheme.eligibilityGender || "ALL",
        ageCriteriaType: scheme.ageCriteriaType || "ALL",
        ageLimit: scheme.ageLimit ?? "",
        minimumAge: scheme.minimumAge ?? "",
        maximumAge: scheme.maximumAge ?? "",
        collectAdditionalInformation: Boolean(scheme.collectAdditionalInformation),
        additionalInformationFields: Array.isArray(scheme.additionalInformationFields)
            ? scheme.additionalInformationFields
            : [],
    };
}

function Schemes() {
    const [schemes, setSchemes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingScheme, setEditingScheme] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formData, setFormData] = useState(emptyForm);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

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

    const filteredSchemes = schemes.filter((scheme) =>
        scheme.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const totalPages = Math.max(1, Math.ceil(filteredSchemes.length / ADMIN_TABLE_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const visibleSchemes = filteredSchemes.slice(
        (currentPage - 1) * ADMIN_TABLE_PAGE_SIZE,
        currentPage * ADMIN_TABLE_PAGE_SIZE
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

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
        setFormData(normalizeSchemeForm(scheme));
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
        const ageLimit = formData.ageLimit === "" ? null : Number(formData.ageLimit);
        const minimumAge = formData.minimumAge === "" ? null : Number(formData.minimumAge);
        const maximumAge = formData.maximumAge === "" ? null : Number(formData.maximumAge);

        if (formData.ageCriteriaType === "UNDER" || formData.ageCriteriaType === "ABOVE") {
            if (!Number.isInteger(ageLimit) || ageLimit < 0 || ageLimit > 150) {
                setError("Age limit must be a whole number between 0 and 150");
                return;
            }
        }
        if (formData.ageCriteriaType === "RANGE") {
            if (
                !Number.isInteger(minimumAge) ||
                !Number.isInteger(maximumAge) ||
                minimumAge < 0 ||
                maximumAge > 150
            ) {
                setError("Minimum and maximum ages must be whole numbers between 0 and 150");
                return;
            }
            if (minimumAge > maximumAge) {
                setError("Minimum age cannot be greater than maximum age");
                return;
            }
        }
        if (
            formData.collectAdditionalInformation &&
            (
                formData.additionalInformationFields.length === 0 ||
                formData.additionalInformationFields.some((field) => !field.label.trim())
            )
        ) {
            setError("Enter a label for every additional information field");
            return;
        }

        const eligibilityData = {
            eligibilityGender: formData.eligibilityGender,
            ageCriteriaType: formData.ageCriteriaType,
            ageLimit: formData.ageCriteriaType === "UNDER" || formData.ageCriteriaType === "ABOVE"
                ? ageLimit
                : null,
            minimumAge: formData.ageCriteriaType === "RANGE" ? minimumAge : null,
            maximumAge: formData.ageCriteriaType === "RANGE" ? maximumAge : null,
            collectAdditionalInformation: formData.collectAdditionalInformation,
            additionalInformationFields: formData.collectAdditionalInformation
                ? formData.additionalInformationFields.map((field) => ({
                    ...field,
                    label: field.label.trim(),
                }))
                : [],
        };

        try {
            setError("");
            if (editingScheme) {
                await updateScheme(editingScheme.id, {
                    name: formData.name.trim(),
                    status: formData.status,
                    ...eligibilityData,
                });
                setSuccess("Scheme updated successfully");
            } else {
                await createScheme({
                    code: formData.code.trim(),
                    name: formData.name.trim(),
                    ...eligibilityData,
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
                <h1>Schemes</h1>
            </div>

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
                    placeholder="Search scheme name"
                />
                <AdminAddButton type="button" onClick={openAddModal}>
                    Add Scheme
                </AdminAddButton>
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

            <div className="admin-table-container">
                {loading ? (
                    <div className="admin-empty-state">Loading schemes...</div>
                ) : filteredSchemes.length === 0 ? (
                    <div className="admin-empty-state">
                        {searchTerm ? "No schemes match your search." : "No schemes found."}
                    </div>
                ) : (
                    <table className="admin-data-table">
                        <thead>
                            <tr>
                                <th>Scheme Code</th>
                                <th>Scheme Name</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleSchemes.map((scheme) => (
                                <tr key={scheme.id}>
                                    <td><strong>{scheme.code}</strong></td>
                                    <td>{scheme.name}</td>
                                    <td>
                                        <span className={`status-select ${String(scheme.status).toLowerCase()}`}>
                                            {scheme.status}
                                        </span>
                                    </td>
                                    <td><button className="admin-row-action-button" onClick={() => openEditModal(scheme)}>Edit</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {!loading && (
                <AdminPagination
                page={currentPage}
                    totalItems={filteredSchemes.length}
                    onPageChange={setPage}
                />
            )}

            {showModal && (
                <div className="user-modal-overlay" onClick={closeModal}>
                    <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="scheme-modal-title" onClick={(event) => event.stopPropagation() }>
                        <div className="user-modal-header">
                            <div>
                                <h2 id="scheme-modal-title">
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
                                    <label>Discount</label>
                                    <input value="100% (fixed)" readOnly disabled />
                                </div>

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

                            <section className="scheme-eligibility">
                                <h3>Eligibility Criteria</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Gender</label>
                                        <select
                                            value={formData.eligibilityGender}
                                            onChange={(event) => setFormData((previous) => ({
                                                ...previous,
                                                eligibilityGender: event.target.value,
                                            }))}
                                        >
                                            <option value="NOT_APPLICABLE">Not Applicable</option>
                                            <option value="ALL">All Genders</option>
                                            <option value="FEMALE">Female</option>
                                            <option value="MALE">Male</option>
                                            <option value="TRANSGENDER">Transgender</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Age</label>
                                        <select
                                            value={formData.ageCriteriaType}
                                            onChange={(event) => setFormData((previous) => ({
                                                ...previous,
                                                ageCriteriaType: event.target.value,
                                            }))}
                                        >
                                            <option value="NOT_APPLICABLE">Not Applicable</option>
                                            <option value="ALL">All Ages</option>
                                            <option value="UNDER">Under a specified age</option>
                                            <option value="ABOVE">Above a specified age</option>
                                            <option value="RANGE">Custom minimum and maximum age</option>
                                        </select>
                                    </div>
                                    {(formData.ageCriteriaType === "UNDER" || formData.ageCriteriaType === "ABOVE") && (
                                        <div className="form-group">
                                            <label>
                                                {formData.ageCriteriaType === "UNDER" ? "Under age" : "Above age"}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="150"
                                                step="1"
                                                value={formData.ageLimit}
                                                onChange={(event) => setFormData((previous) => ({
                                                    ...previous,
                                                    ageLimit: event.target.value,
                                                }))}
                                            />
                                        </div>
                                    )}
                                    {formData.ageCriteriaType === "RANGE" && (
                                        <>
                                            <div className="form-group">
                                                <label>Minimum age</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="150"
                                                    step="1"
                                                    value={formData.minimumAge}
                                                    onChange={(event) => setFormData((previous) => ({
                                                        ...previous,
                                                        minimumAge: event.target.value,
                                                    }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Maximum age</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="150"
                                                    step="1"
                                                    value={formData.maximumAge}
                                                    onChange={(event) => setFormData((previous) => ({
                                                        ...previous,
                                                        maximumAge: event.target.value,
                                                    }))}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <label className="scheme-collect-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={formData.collectAdditionalInformation}
                                        onChange={(event) => setFormData((previous) => ({
                                            ...previous,
                                            collectAdditionalInformation: event.target.checked,
                                            additionalInformationFields: event.target.checked
                                                ? (previous.additionalInformationFields.length
                                                    ? previous.additionalInformationFields
                                                    : [newAdditionalField()])
                                                : [],
                                        }))}
                                    />
                                    Collect additional information
                                </label>

                                {formData.collectAdditionalInformation && (
                                    <div className="scheme-additional-fields">
                                        {formData.additionalInformationFields.map((field, index) => (
                                            <div className="scheme-additional-field" key={field.key}>
                                                <input
                                                    type="text"
                                                    aria-label={`Additional field ${index + 1} label`}
                                                    placeholder="Field label, e.g. Ration Card Number"
                                                    value={field.label}
                                                    onChange={(event) => setFormData((previous) => ({
                                                        ...previous,
                                                        additionalInformationFields: previous.additionalInformationFields.map((item) =>
                                                            item.key === field.key
                                                                ? { ...item, label: event.target.value }
                                                                : item
                                                        ),
                                                    }))}
                                                />
                                                <button
                                                    type="button"
                                                    className="scheme-field-add"
                                                    aria-label="Add field"
                                                    onClick={() => setFormData((previous) => ({
                                                        ...previous,
                                                        additionalInformationFields: [
                                                            ...previous.additionalInformationFields,
                                                            newAdditionalField(),
                                                        ],
                                                    }))}
                                                >+</button>
                                                <button
                                                    type="button"
                                                    className="scheme-field-remove"
                                                    aria-label="Remove field"
                                                    onClick={() => setFormData((previous) => ({
                                                        ...previous,
                                                        additionalInformationFields: previous.additionalInformationFields.filter(
                                                            (item) => item.key !== field.key
                                                        ),
                                                    }))}
                                                >Remove</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

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
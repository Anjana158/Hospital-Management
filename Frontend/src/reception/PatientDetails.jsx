import { useEffect, useState } from "react";

import { updatePatient } from "./services/patientService";

const KERALA_DISTRICTS = [
    "Alappuzha",
    "Ernakulam",
    "Idukki",
    "Kannur",
    "Kasaragod",
    "Kollam",
    "Kottayam",
    "Kozhikode",
    "Malappuram",
    "Palakkad",
    "Pathanamthitta",
    "Thiruvananthapuram",
    "Thrissur",
    "Wayanad",
];

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString();
}

function toDateInputValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
}

function displayValue(value) {
    return value === null || value === undefined || value === "" ? "—" : value;
}

function isValidPhone(value) {
    if (!value) {
        return false;
    }

    if (!/^[+\d\s().-]+$/.test(value.trim())) {
        return false;
    }

    const digitCount = value.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 15;
}

function buildForm(patient) {
    return {
        firstName: patient.firstName || "",
        middleName: patient.middleName || "",
        lastName: patient.lastName || "",
        dateOfBirth: toDateInputValue(patient.dateOfBirth),
        gender: patient.gender || "UNKNOWN",
        phone: patient.phone || "",
        alternatePhone: patient.alternatePhone || "",
        email: patient.email || "",
        addressLine1: patient.addressLine1 || "",
        addressLine2: patient.addressLine2 || "",
        city: patient.city || "",
        district: patient.district || "",
        state: patient.state || "",
        postalCode: patient.postalCode || "",
        country: patient.country || "",
        categoryId: patient.category?.id ? String(patient.category.id) : "",
    };
}

function PatientDetails({
    patient,
    onBack,
    onAfterUpdate,
    categories = [],
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(() => buildForm(patient));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setFormData(buildForm(patient));
        setIsEditing(false);
        setError("");
    }, [patient]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleCancelEdit = () => {
        setFormData(buildForm(patient));
        setIsEditing(false);
        setError("");
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setError("");

        if (!formData.firstName.trim()) {
            setError("First name is required");
            return;
        }

        if (formData.dateOfBirth) {
            const dateOfBirth = new Date(formData.dateOfBirth);
            if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
                setError("Date of birth must be a valid past date");
                return;
            }
        }

        if (!isValidPhone(formData.phone)) {
            setError("Enter a valid phone number (7–15 digits)");
            return;
        }

        if (formData.alternatePhone && !isValidPhone(formData.alternatePhone)) {
            setError("Enter a valid alternate phone number (7–15 digits)");
            return;
        }

        if (!formData.categoryId && categories.length > 0) {
            setError("Patient category is required");
            return;
        }

        try {
            setSaving(true);

            const payload = {
                firstName: formData.firstName.trim(),
                middleName: formData.middleName.trim(),
                lastName: formData.lastName.trim(),
                dateOfBirth: formData.dateOfBirth,
                gender: formData.gender,
                phone: formData.phone.trim(),
                alternatePhone: formData.alternatePhone.trim(),
                email: formData.email.trim(),
                addressLine1: formData.addressLine1.trim(),
                addressLine2: formData.addressLine2.trim(),
                city: formData.city.trim(),
                district: formData.district.trim(),
                state: formData.state.trim(),
                postalCode: formData.postalCode.trim(),
                country: formData.country.trim(),
            };

            if (formData.categoryId) {
                payload.categoryId = Number(formData.categoryId);
            }

            const result = await updatePatient(patient.id, payload);
            onAfterUpdate(result.data);
            setIsEditing(false);
        } catch (saveError) {
            if (
                saveError.response?.status === 409 &&
                saveError.response?.data?.code === "PATIENT_DUPLICATE_PHONE"
            ) {
                const duplicates = saveError.response.data.duplicates || [];
                const names = duplicates
                    .map((item) => item.uhid || item.firstName)
                    .filter(Boolean)
                    .join(", ");
                setError(
                    names
                        ? `Phone number already used by: ${names}`
                        : saveError.response.data.message || "Duplicate phone number"
                );
                return;
            }

            setError(
                saveError.response?.data?.message ||
                "Failed to update patient"
            );
        } finally {
            setSaving(false);
        }
    };

    const fullName = [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(" ");

    const categoryOptions = categories.length > 0
        ? categories
        : patient.category
            ? [patient.category]
            : [];

    return (
        <div className="patient-details-container">
            <div className="patient-details-header">
                <div>
                    <h2>{fullName || "Patient details"}</h2>
                </div>
                <div className="patient-details-actions">
                    {!isEditing && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onBack}
                        disabled={saving}
                    >
                        Back
                    </button>
                </div>
            </div>

            {error && <div className="patient-error">{error}</div>}

            {isEditing ? (
                <form className="patient-form" onSubmit={handleSave}>
                    <div className="detail-section">
                        <h3>Record</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>UHID</label>
                                <span>{patient.uhid}</span>
                            </div>
                            <div className="detail-item">
                                <label>Status</label>
                                <span
                                    className={`status-badge ${
                                        patient.status === "ACTIVE"
                                            ? "active"
                                            : "inactive"
                                    }`}
                                >
                                    {patient.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="required">First name</label>
                            <input
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                        <div className="form-group">
                            <label>Middle name</label>
                            <input
                                name="middleName"
                                value={formData.middleName}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Last name</label>
                            <input
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                        <div className="form-group">
                            <label>Date of birth</label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Gender</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                disabled={saving}
                            >
                                <option value="UNKNOWN">Unknown</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <select
                                name="categoryId"
                                value={formData.categoryId}
                                onChange={handleChange}
                                disabled={saving || categoryOptions.length === 0}
                            >
                                {categoryOptions.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="required">Phone</label>
                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                        <div className="form-group">
                            <label>Alternate phone</label>
                            <input
                                name="alternatePhone"
                                value={formData.alternatePhone}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row full">
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row full">
                        <div className="form-group">
                            <label>Address line 1</label>
                            <input
                                name="addressLine1"
                                value={formData.addressLine1}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row full">
                        <div className="form-group">
                            <label>Address line 2</label>
                            <input
                                name="addressLine2"
                                value={formData.addressLine2}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>City</label>
                            <input
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                        <div className="form-group">
                            <label>District</label>
                            <select
                                name="district"
                                value={formData.district}
                                onChange={handleChange}
                                disabled={saving}
                            >
                                <option value="">Select district</option>
                                {formData.district &&
                                    !KERALA_DISTRICTS.includes(formData.district) && (
                                    <option value={formData.district}>
                                        {formData.district}
                                    </option>
                                )}
                                {KERALA_DISTRICTS.map((district) => (
                                    <option key={district} value={district}>
                                        {district}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>State</label>
                            <input
                                name="state"
                                value={formData.state}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                        <div className="form-group">
                            <label>Country</label>
                            <input
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Postal code</label>
                            <input
                                name="postalCode"
                                value={formData.postalCode}
                                onChange={handleChange}
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="form-buttons">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCancelEdit}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="detail-section">
                        <h3>Record</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>UHID</label>
                                <span>{displayValue(patient.uhid)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Status</label>
                                <span
                                    className={`status-badge ${
                                        patient.status === "ACTIVE"
                                            ? "active"
                                            : "inactive"
                                    }`}
                                >
                                    {displayValue(patient.status)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <label>Category</label>
                                <span className="category-badge">
                                    {displayValue(patient.category?.name)}
                                </span>
                            </div>
                            {patient.category?.discountEligible !== undefined && (
                                <div className="detail-item">
                                    <label>Discount eligible</label>
                                    <span>
                                        {patient.category.discountEligible ? "Yes" : "No"}
                                    </span>
                                </div>
                            )}
                            <div className="detail-item">
                                <label>Created</label>
                                <span>{formatDate(patient.createdAt)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Updated</label>
                                <span>{formatDate(patient.updatedAt)}</span>
                            </div>
                            {patient.archivedAt && (
                                <div className="detail-item">
                                    <label>Archived</label>
                                    <span>{formatDate(patient.archivedAt)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="detail-section">
                        <h3>Personal</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>First name</label>
                                <span>{displayValue(patient.firstName)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Middle name</label>
                                <span>{displayValue(patient.middleName)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Last name</label>
                                <span>{displayValue(patient.lastName)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Date of birth</label>
                                <span>{formatDate(patient.dateOfBirth)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Gender</label>
                                <span>{displayValue(patient.gender)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h3>Contact</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Phone</label>
                                <span>{displayValue(patient.phone)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Alternate phone</label>
                                <span>{displayValue(patient.alternatePhone)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Email</label>
                                <span>{displayValue(patient.email)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h3>Address</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Address line 1</label>
                                <span>{displayValue(patient.addressLine1)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Address line 2</label>
                                <span>{displayValue(patient.addressLine2)}</span>
                            </div>
                            <div className="detail-item">
                                <label>City</label>
                                <span>{displayValue(patient.city)}</span>
                            </div>
                            <div className="detail-item">
                                <label>District</label>
                                <span>{displayValue(patient.district)}</span>
                            </div>
                            <div className="detail-item">
                                <label>State</label>
                                <span>{displayValue(patient.state)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Postal code</label>
                                <span>{displayValue(patient.postalCode)}</span>
                            </div>
                            <div className="detail-item">
                                <label>Country</label>
                                <span>{displayValue(patient.country)}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default PatientDetails;

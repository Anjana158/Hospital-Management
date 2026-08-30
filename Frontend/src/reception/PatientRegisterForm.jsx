import { useEffect, useState } from "react";

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

const emptyForm = {
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "UNKNOWN",
    phone: "",
    alternatePhone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    district: "Thrissur",
    state: "Kerala",
    postalCode: "",
    country: "India",
    categoryId: "",
};

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

function PatientRegisterForm({
    onRegister,
    onCancel,
    loading,
    categories = [],
    showDuplicates = false,
}) {
    const [formData, setFormData] = useState(emptyForm);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        const generalCategory = categories.find(
            (category) => String(category.code).toUpperCase() === "GENERAL"
        );

        if (!generalCategory) {
            return;
        }

        setFormData((previous) => {
            if (previous.categoryId) {
                return previous;
            }

            return {
                ...previous,
                categoryId: String(generalCategory.id),
            };
        });
    }, [categories]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setFormError("");

        if (!formData.firstName.trim()) {
            setFormError("First name is required");
            return;
        }

        if (!formData.dateOfBirth) {
            setFormError("Date of birth is required");
            return;
        }

        const dateOfBirth = new Date(formData.dateOfBirth);
        if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
            setFormError("Date of birth must be a valid past date");
            return;
        }

        if (!isValidPhone(formData.phone)) {
            setFormError("Enter a valid phone number (7–15 digits)");
            return;
        }

        if (formData.alternatePhone && !isValidPhone(formData.alternatePhone)) {
            setFormError("Enter a valid alternate phone number (7–15 digits)");
            return;
        }

        if (!formData.categoryId) {
            setFormError("Patient category is required");
            return;
        }

        onRegister({
            ...formData,
            categoryId: Number(formData.categoryId),
        });
    };

    return (
        <form className="patient-form" onSubmit={handleSubmit}>
            {formError && <div className="form-error">{formError}</div>}

            <div className="form-row">
                <div className="form-group">
                    <label className="required">First name</label>
                    <input
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label>Middle name</label>
                    <input
                        name="middleName"
                        value={formData.middleName}
                        onChange={handleChange}
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label className="required">Date of birth</label>
                    <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        disabled={loading}
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
                        disabled={loading}
                    >
                        <option value="UNKNOWN">Unknown</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="required">Category</label>
                    <select
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleChange}
                        disabled={loading || categories.length === 0}
                    >
                        <option value="">
                            {categories.length === 0
                                ? "Categories unavailable"
                                : "Select category"}
                        </option>
                        {categories.map((category) => (
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
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label>Alternate phone</label>
                    <input
                        name="alternatePhone"
                        value={formData.alternatePhone}
                        onChange={handleChange}
                        disabled={loading}
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
                        disabled={loading}
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
                        disabled={loading}
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
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label>District</label>
                    <select
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        <option value="">Select district</option>
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
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label>Country</label>
                    <input
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="form-buttons">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading
                        ? "Saving..."
                        : showDuplicates
                            ? "Register anyway"
                            : "Register patient"}
                </button>
            </div>
        </form>
    );
}

export default PatientRegisterForm;

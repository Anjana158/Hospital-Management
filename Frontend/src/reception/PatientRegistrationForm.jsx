import { useEffect, useMemo, useState } from "react";

import { getPatientDepartmentVisitHistory } from "./services/visitService";
import { getSchemeEligibility } from "./utils/schemeEligibility";
import "../styles/PatientManagement.css";

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
    dateOfBirth: "",
    age: "",
    gender: "",
    phone: "",
    alternatePhone: "",
    email: "",
    addressLine1: "",
    city: "",
    district: "Thrissur",
    state: "Kerala",
    country: "India",
    postalCode: "",
    schemeId: "",
    departmentId: "",
    visitType: "NEW",
    opFee: "10",
    paymentMethod: "",
    authCode: "",
};

function calculateAgeFromDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    const birthDate = new Date(year, month - 1, day);
    if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.getFullYear() !== year ||
        birthDate.getMonth() !== month - 1 ||
        birthDate.getDate() !== day
    ) {
        return "";
    }

    const today = new Date();
    let age = today.getFullYear() - year;
    if (
        today.getMonth() < month - 1 ||
        (today.getMonth() === month - 1 && today.getDate() < day)
    ) {
        age -= 1;
    }
    return age;
}

function calculateApproximateDob(value) {
    if (value === "") return "";
    const age = Number(value);
    if (!Number.isInteger(age) || age < 0 || age > 150) return "";
    return `${new Date().getFullYear() - age}-01-01`;
}

function formatDateInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function buildInitialForm(patient) {
    if (!patient) return emptyForm;
    return {
        ...emptyForm,
        firstName: patient.firstName || "",
        dateOfBirth: formatDateInput(patient.dateOfBirth),
        age: patient.age === null || patient.age === undefined ? "" : String(patient.age),
        gender: patient.gender || "",
        phone: patient.phone || "",
        alternatePhone: patient.alternatePhone || "",
        email: patient.email || "",
        addressLine1: patient.addressLine1 || "",
        city: patient.city || "",
        district: patient.district || "",
        state: patient.state || "",
        country: patient.country || "",
        postalCode: patient.postalCode || "",
        schemeId: patient.scheme?.id
            ? String(patient.scheme.id)
            : patient.schemeId
                ? String(patient.schemeId)
                : "",
    };
}

function isValidPhone(value) {
    return !value || /^\d{10}$/.test(value.trim());
}

function hasValidAgeValue(value) {
    if (value === "") return false;
    const age = Number(value);
    return Number.isInteger(age) && age >= 0 && age <= 150;
}

function PatientRegistrationForm({
    onOpTicket,
    loading = false,
    schemes = [],
    departments = [],
    initialPatient = null,
    serverError = "",
}) {
    const [formData, setFormData] = useState(() => buildInitialForm(initialPatient));
    const [formError, setFormError] = useState("");
    const [historyError, setHistoryError] = useState("");
    const [visitHistory, setVisitHistory] = useState({
        hasPreviousVisit: false,
        hasVisitToday: false,
        visitType: "NEW",
        revisitCount: 0,
    });
    const [schemeSelectionIsManual, setSchemeSelectionIsManual] = useState(
        () => Boolean(initialPatient?.scheme?.id || initialPatient?.schemeId)
    );
    const [schemeAdditionalInformation, setSchemeAdditionalInformation] = useState(
        () => initialPatient?.schemeAdditionalInformation || []
    );

    const hasSufficientSchemeInfo = Boolean(formData.gender) && hasValidAgeValue(formData.age);
    const patientAgeForEligibility = hasSufficientSchemeInfo ? Number(formData.age) : null;

    const selectedScheme = schemes.find(
        (scheme) => String(scheme.id) === String(formData.schemeId)
    ) || (
        formData.schemeId &&
        String(initialPatient?.scheme?.id) === String(formData.schemeId) &&
        initialPatient.scheme.status !== "INACTIVE"
            ? initialPatient.scheme
            : null
    );

    const schemeEligibility = hasSufficientSchemeInfo
        ? getSchemeEligibility(selectedScheme, formData.gender, patientAgeForEligibility)
        : { eligible: false, pending: true, message: "" };

    const eligibleSchemes = useMemo(() => {
        if (!hasSufficientSchemeInfo) return [];
        return schemes.filter((scheme) =>
            scheme.status !== "INACTIVE" &&
            getSchemeEligibility(scheme, formData.gender, patientAgeForEligibility).eligible
        );
    }, [schemes, formData.gender, patientAgeForEligibility, hasSufficientSchemeInfo]);

    const numericFee = Number(formData.opFee);
    const finalFee = numericFee - (
        selectedScheme && hasSufficientSchemeInfo && schemeEligibility.eligible ? numericFee : 0
    );

    useEffect(() => {
        if (!hasSufficientSchemeInfo) {
            setFormData((previous) => previous.schemeId === ""
                ? previous
                : { ...previous, schemeId: "" }
            );
            setSchemeSelectionIsManual(false);
            return;
        }

        if (formData.schemeId) {
            const selectedIsEligible = eligibleSchemes.some(
                (scheme) => String(scheme.id) === String(formData.schemeId)
            );
            if (!selectedIsEligible) {
                setFormData((previous) => previous.schemeId === ""
                    ? previous
                    : { ...previous, schemeId: "" }
                );
                setSchemeSelectionIsManual(false);
                return;
            }
        }

        if (schemeSelectionIsManual) return;

        const nextSchemeId = eligibleSchemes.length === 1
            ? String(eligibleSchemes[0].id)
            : "";
        setFormData((previous) => previous.schemeId === nextSchemeId
            ? previous
            : { ...previous, schemeId: nextSchemeId }
        );
    }, [eligibleSchemes, schemeSelectionIsManual, hasSufficientSchemeInfo, formData.schemeId]);

    useEffect(() => {
        const configuredFields = selectedScheme?.collectAdditionalInformation
            ? selectedScheme.additionalInformationFields || []
            : [];
        const initialValues = String(initialPatient?.scheme?.id) === String(selectedScheme?.id)
            ? initialPatient?.schemeAdditionalInformation || []
            : [];
        const valuesByKey = new Map(initialValues.map((field) => [field.key, field.value]));

        setSchemeAdditionalInformation(configuredFields.map((field) => ({
            key: field.key,
            label: field.label,
            value: valuesByKey.get(field.key) ?? "",
        })));
    }, [
        initialPatient?.scheme?.id,
        initialPatient?.schemeAdditionalInformation,
        selectedScheme?.id,
        selectedScheme?.additionalInformationFields,
        selectedScheme?.collectAdditionalInformation,
    ]);

    useEffect(() => {
        let active = true;

        if (!initialPatient?.id || !formData.departmentId) {
            setVisitHistory({
                hasPreviousVisit: false,
                hasVisitToday: false,
                visitType: "NEW",
                revisitCount: 0,
            });
            setHistoryError("");
            setFormData((previous) => previous.visitType === "NEW"
                ? previous
                : { ...previous, visitType: "NEW" }
            );
            return () => {
                active = false;
            };
        }

        getPatientDepartmentVisitHistory(initialPatient.id, Number(formData.departmentId))
            .then((response) => {
                if (!active) return;
                const history = response.data || {};
                const visitType = history.visitType || "NEW";
                setVisitHistory(history);
                setHistoryError("");
                setFormData((previous) => ({ ...previous, visitType }));
            })
            .catch((error) => {
                if (!active) return;
                setHistoryError(
                    error.response?.data?.message || "Failed to load department visit history."
                );
            });

        return () => {
            active = false;
        };
    }, [initialPatient?.id, formData.departmentId]);

    function handleChange(event) {
        const { name, value } = event.target;
        setFormError("");
        setHistoryError("");

        if (name === "dateOfBirth") {
            setFormData((previous) => ({
                ...previous,
                dateOfBirth: value,
                age: value ? String(calculateAgeFromDate(value)) : "",
            }));
            setSchemeSelectionIsManual(false);
            return;
        }

        if (name === "age") {
            setFormData((previous) => ({
                ...previous,
                age: value,
                dateOfBirth: calculateApproximateDob(value),
            }));
            setSchemeSelectionIsManual(false);
            return;
        }

        if (name === "schemeId") {
            setSchemeSelectionIsManual(true);
            setFormData((previous) => ({ ...previous, schemeId: value }));
            return;
        }

        if (name === "paymentMethod") {
            setFormData((previous) => ({
                ...previous,
                paymentMethod: value,
                authCode: value === "POS" ? previous.authCode : "",
            }));
            return;
        }

        if (name === "gender") {
            setSchemeSelectionIsManual(false);
            setFormData((previous) => ({ ...previous, gender: value }));
            return;
        }

        setFormData((previous) => ({ ...previous, [name]: value }));
    }

    function handleSubmit(event) {
        event.preventDefault();
        setFormError("");

        if (!formData.firstName.trim()) {
            setFormError("Patient name is required.");
            return;
        }

        const hasDateOfBirth = Boolean(formData.dateOfBirth);
        const hasAge = formData.age !== "";
        if (!hasDateOfBirth && !hasAge) {
            setFormError("Enter either Date of Birth or Age.");
            return;
        }

        const age = hasAge ? Number(formData.age) : undefined;
        if (hasAge && (!Number.isInteger(age) || age < 0 || age > 150)) {
            setFormError("Age must be a whole number between 0 and 150.");
            return;
        }

        if (hasDateOfBirth) {
            const calculatedAge = calculateAgeFromDate(formData.dateOfBirth);
            if (
                calculatedAge === "" ||
                calculatedAge < 0 ||
                calculatedAge > 150 ||
                new Date(`${formData.dateOfBirth}T00:00:00`) > new Date()
            ) {
                setFormError("Date of Birth must be a valid date that is not in the future.");
                return;
            }
            if (hasAge && age !== calculatedAge) {
                setFormError("Age does not match Date of Birth.");
                return;
            }
        }

        if (!formData.gender) {
            setFormError("Gender is required.");
            return;
        }
        if (!formData.departmentId) {
            setFormError("Department is required.");
            return;
        }
        if (historyError) {
            setFormError(historyError);
            return;
        }
        if (visitHistory.hasVisitToday) {
            setFormError("Patient has already registered an OP visit in this department today.");
            return;
        }
        if (formData.phone.trim() && !isValidPhone(formData.phone)) {
            setFormError("Enter a valid phone number (10 digits only).");
            return;
        }
        if (formData.alternatePhone && !isValidPhone(formData.alternatePhone)) {
            setFormError("Enter a valid alternate phone number (10 digits only).");
            return;
        }
        if (
            formData.phone.trim() &&
            formData.alternatePhone &&
            formData.phone === formData.alternatePhone
        ) {
            setFormError("Primary and alternate phone numbers cannot be the same.");
            return;
        }
        if (eligibleSchemes.length > 1 && !selectedScheme) {
            setFormError("Multiple schemes match this patient. Select an eligible scheme to continue.");
            return;
        }
        if (selectedScheme && !schemeEligibility.eligible) {
            setFormError(schemeEligibility.message);
            return;
        }
        if (!Number.isFinite(numericFee) || numericFee < 0) {
            setFormError("OP Fee must be a valid non-negative amount.");
            return;
        }
        if (finalFee > 0 && !formData.paymentMethod) {
            setFormError("Select a payment method.");
            return;
        }
        if (
            finalFee > 0 &&
            formData.paymentMethod === "POS" &&
            !formData.authCode.trim()
        ) {
            setFormError("Auth Code is required for POS payments.");
            return;
        }

        onOpTicket({
            ...formData,
            age,
            schemeId: selectedScheme ? Number(selectedScheme.id) : null,
            schemeAdditionalInformation: schemeAdditionalInformation.map(
                ({ key, value }) => ({ key, value })
            ),
            departmentId: Number(formData.departmentId),
            opFee: numericFee,
            paymentMethod: finalFee === 0 ? "CASH" : formData.paymentMethod,
            authCode: finalFee > 0 && formData.paymentMethod === "POS"
                ? formData.authCode.trim()
                : undefined,
        });
    }

    const activeDepartments = departments.filter(
        (department) => department.status === "ACTIVE"
    );

    return (
        <form className="patient-form" onSubmit={handleSubmit} noValidate>
            {(formError || serverError) && (
                <div className="form-error registration-full-row" role="alert">
                    {formError || serverError}
                </div>
            )}

            <div className="registration-grid-row registration-grid-four">
                <div className="form-group">
                    <label className="required" htmlFor="patient-name">Patient Name</label>
                    <input
                        id="patient-name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        maxLength={300}
                        disabled={loading}
                        autoComplete="name"
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="required" htmlFor="patient-gender">Gender</label>
                    <select
                        id="patient-gender"
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        disabled={loading}
                        required
                    >
                        <option value="">Select gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="TRANSGENDER">Transgender</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="required" htmlFor="patient-dob">Date of Birth</label>
                    <input
                        id="patient-dob"
                        type="date"
                        name="dateOfBirth"
                        max={new Date().toISOString().slice(0, 10)}
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label className="required" htmlFor="patient-age">Age</label>
                    <input
                        id="patient-age"
                        type="number"
                        name="age"
                        min="0"
                        max="150"
                        step="1"
                        value={formData.age}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>
                <small className="registration-full-row">
                    Enter a Date of Birth or Age. The other field is calculated automatically.
                </small>
            </div>

            <div className="registration-grid-row">
                <div className="form-group">
                    <label htmlFor="patient-scheme">Scheme</label>
                    <select
                        id="patient-scheme"
                        name="schemeId"
                        value={formData.schemeId}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        <option value="">No scheme</option>
                        {(hasSufficientSchemeInfo
                            ? eligibleSchemes
                            : schemes.filter((scheme) => scheme.status === "ACTIVE")
                        ).map((scheme) => (
                            <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="patient-phone">Phone Number</label>
                    <input
                        id="patient-phone"
                        name="phone"
                        inputMode="numeric"
                        maxLength={10}
                        value={formData.phone}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="tel"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-email">Email</label>
                    <input
                        id="patient-email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="email"
                    />
                </div>
            </div>

            <div className="registration-grid-row">
                <div className="form-group">
                    <label htmlFor="patient-address">Address</label>
                    <input
                        id="patient-address"
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="street-address"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-city">City</label>
                    <input
                        id="patient-city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="address-level2"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-district">District</label>
                    <select
                        id="patient-district"
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        <option value="">Select district</option>
                        {KERALA_DISTRICTS.map((district) => (
                            <option key={district} value={district}>{district}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="registration-grid-row">
                <div className="form-group">
                    <label htmlFor="patient-state">State</label>
                    <input
                        id="patient-state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="address-level1"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-country">Country</label>
                    <input
                        id="patient-country"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="country-name"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-postal-code">Postal Code</label>
                    <input
                        id="patient-postal-code"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleChange}
                        disabled={loading}
                        autoComplete="postal-code"
                    />
                </div>
            </div>

            <div className="registration-grid-row">
                <div className="form-group">
                    <label className="required" htmlFor="patient-department">Department</label>
                    <select
                        id="patient-department"
                        name="departmentId"
                        value={formData.departmentId}
                        onChange={handleChange}
                        disabled={loading}
                        required
                    >
                        <option value="">Select department</option>
                        {activeDepartments.map((department) => (
                            <option key={department.id} value={department.id}>
                                {department.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="patient-visit-type">Visit Type</label>
                    <input
                        id="patient-visit-type"
                        className="registration-readonly"
                        value={formData.visitType === "REVISIT" ? "Revisit" : "New Visit"}
                        readOnly
                        disabled
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="patient-op-fee">OP Fee</label>
                    <input
                        id="patient-op-fee"
                        type="number"
                        name="opFee"
                        min="0"
                        max="100000"
                        step="0.01"
                        value={formData.opFee}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="registration-grid-row">
                <div className="form-group">
                    <label htmlFor="patient-payment-method">Payment Method</label>
                    <select
                        id="patient-payment-method"
                        name="paymentMethod"
                        value={finalFee === 0 ? "CASH" : formData.paymentMethod}
                        onChange={handleChange}
                        disabled={loading || finalFee === 0}
                        required={finalFee > 0}
                    >
                        {finalFee === 0 ? (
                            <option value="CASH">Cash (waived)</option>
                        ) : (
                            <>
                                <option value="">Select payment method</option>
                                <option value="CASH">Cash</option>
                                <option value="POS">POS</option>
                            </>
                        )}
                    </select>
                </div>
                {formData.paymentMethod === "POS" && finalFee > 0 ? (
                    <div className="form-group">
                        <label className="required" htmlFor="patient-auth-code">Auth Code</label>
                        <input
                            id="patient-auth-code"
                            name="authCode"
                            value={formData.authCode}
                            onChange={handleChange}
                            disabled={loading}
                            required
                        />
                    </div>
                ) : <div aria-hidden="true" />}
                <div aria-hidden="true" />
            </div>

            {hasSufficientSchemeInfo && selectedScheme && (
                <div className={`scheme-eligibility-message ${schemeEligibility.eligible ? "eligible" : "ineligible"}`}>
                    {schemeEligibility.eligible
                        ? `${selectedScheme.name} is eligible.`
                        : schemeEligibility.message}
                </div>
            )}

            {hasSufficientSchemeInfo && eligibleSchemes.length > 1 && !selectedScheme && (
                <div className="scheme-eligibility-message ineligible">
                    Multiple schemes match this patient. Select an eligible scheme to continue.
                </div>
            )}

            {selectedScheme?.collectAdditionalInformation &&
                schemeAdditionalInformation.length > 0 && (
                    <div className="scheme-patient-fields">
                        <h4>Additional scheme information</h4>
                        <div className="registration-grid-row">
                            {schemeAdditionalInformation.map((field) => (
                                <div className="form-group" key={field.key}>
                                    <label htmlFor={`scheme-field-${field.key}`}>{field.label}</label>
                                    <input
                                        id={`scheme-field-${field.key}`}
                                        value={field.value}
                                        onChange={(event) => setSchemeAdditionalInformation((previous) =>
                                            previous.map((item) => item.key === field.key
                                                ? { ...item, value: event.target.value }
                                                : item
                                            )
                                        )}
                                        disabled={loading}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            <div className="form-buttons">
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                        loading ||
                        Boolean(selectedScheme && !schemeEligibility.eligible) ||
                        (eligibleSchemes.length > 1 && !selectedScheme) ||
                        Boolean(historyError) ||
                        visitHistory.hasVisitToday
                    }
                >
                    {loading ? "Registering…" : "Register and Print OP Ticket"}
                </button>
            </div>
        </form>
    );
}

export default PatientRegistrationForm;

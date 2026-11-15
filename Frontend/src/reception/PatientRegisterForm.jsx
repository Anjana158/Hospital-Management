import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap-grid.min.css";

import { getPatientDepartmentVisitHistory } from "./services/visitService";
import { getSchemeEligibility } from "./utils/schemeEligibility";

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
    age: "",

    gender: "",

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

    schemeId: "",

    departmentId: "",
    visitType: "NEW",
    opFee: "10",
};


/*
|--------------------------------------------------------------------------
| Phone Validation
|--------------------------------------------------------------------------
*/

function isValidPhone(value) {
    if (!value || !value.trim()) {
        return true;
    }

    return /^\d{10}$/.test(value.trim());
}


/*
|--------------------------------------------------------------------------
| Calculate Age from DOB
|--------------------------------------------------------------------------
*/

function calculateAgeFromDate(
    dateString
) {
    if (!dateString) {
        return "";
    }

    const birthDate =
        new Date(`${dateString}T00:00:00`);

    if (
        Number.isNaN(
            birthDate.getTime()
        )
    ) {
        return "";
    }

    const today = new Date();

    let age =
        today.getFullYear() -
        birthDate.getFullYear();

    const monthDifference =
        today.getMonth() -
        birthDate.getMonth();

    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getDate() <
                birthDate.getDate()
        )
    ) {
        age--;
    }

    return age;
}


/*
|--------------------------------------------------------------------------
| Calculate Approximate DOB from Age
|--------------------------------------------------------------------------
*/

function calculateApproximateDob(
    age
) {
    const numericAge =
        Number(age);

    if (
        !Number.isInteger(
            numericAge
        ) ||
        numericAge < 0 ||
        numericAge > 150
    ) {
        return "";
    }

    const currentYear =
        new Date().getFullYear();

    return `${
        currentYear - numericAge
    }-01-01`;
}


/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

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

function buildInitialForm(patient) {
    if (!patient) {
        return emptyForm;
    }

    return {
        ...emptyForm,
        firstName: patient.firstName || "",
        middleName: patient.middleName || "",
        lastName: patient.lastName || "",
        dateOfBirth: toDateInputValue(patient.dateOfBirth),
        age: patient.age !== null && patient.age !== undefined
            ? String(patient.age)
            : "",
        gender: patient.gender || "",
        phone: patient.phone || "",
        alternatePhone: patient.alternatePhone || "",
        email: patient.email || "",
        addressLine1: patient.addressLine1 || "",
        addressLine2: patient.addressLine2 || "",
        city: patient.city || "",
        district: patient.district || "Thrissur",
        state: patient.state || "Kerala",
        postalCode: patient.postalCode || "",
        country: patient.country || "India",
        schemeId: patient.scheme?.id
            ? String(patient.scheme.id)
            : patient.schemeId
                ? String(patient.schemeId)
                : "",
        departmentId: "",
        visitType: "NEW",
        opFee: "10",
    };
}

function PatientRegisterForm({
    onOpTicket,
    loading,
    schemes = [],
    departments = [],
    initialPatient = null,
    serverError = "",
}) {
    const [formData, setFormData] =
        useState(() => buildInitialForm(initialPatient));

    const [visitHistory, setVisitHistory] = useState({
        hasPreviousVisit: false,
        hasVisitToday: false,
        visitType: "NEW",
        revisitCount: 0,
    });

    const [formError, setFormError] =
        useState("");
    const [schemeSelectionIsManual, setSchemeSelectionIsManual] = useState(false);
    const [schemeAdditionalInformation, setSchemeAdditionalInformation] =
        useState(() => initialPatient?.schemeAdditionalInformation || []);


    /*
    |--------------------------------------------------------------------------
    | Handle Input Changes
    |--------------------------------------------------------------------------
    */

    const handleChange = (event) => {
        const {
            name,
            value,
        } = event.target;

        /*
        |--------------------------------------------------------------------------
        | DOB changed
        |--------------------------------------------------------------------------
        |
        | Automatically update age.
        |
        */

        if (
            name === "dateOfBirth"
        ) {
            setSchemeSelectionIsManual(false);
            const calculatedAge =
                calculateAgeFromDate(
                    value
                );

            setFormData(
                (previous) => ({
                    ...previous,

                    dateOfBirth:
                        value,

                    age:
                        calculatedAge,
                })
            );

            setFormError("");

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Age changed
        |--------------------------------------------------------------------------
        |
        | Automatically update DOB.
        |
        */

        if (name === "age") {
            setSchemeSelectionIsManual(false);
            if (value === "") {
                setFormData(
                    (previous) => ({
                        ...previous,

                        age: "",
                        dateOfBirth: "",
                    })
                );

                setFormError("");

                return;
            }

            const numericAge =
                Number(value);

            const approximateDob =
                calculateApproximateDob(
                    numericAge
                );

            setFormData(
                (previous) => ({
                    ...previous,

                    age: value,

                    dateOfBirth:
                        approximateDob,
                })
            );

            setFormError("");

            return;
        }

        if (name === "schemeId") {
            setSchemeSelectionIsManual(true);
            const nextScheme = schemes.find(
                (scheme) => String(scheme.id) === String(value)
            ) || (
                value && String(initialPatient?.scheme?.id) === String(value)
                    && initialPatient.scheme.status !== "INACTIVE"
                    ? initialPatient.scheme
                    : null
            );
            const nextFields = nextScheme?.collectAdditionalInformation
                ? nextScheme.additionalInformationFields || []
                : [];
            setFormData((previous) => ({
                ...previous,
                schemeId: value,
            }));
            setSchemeAdditionalInformation(nextFields.map((field) => ({
                key: field.key,
                label: field.label,
                value: "",
            })));
            setFormError("");
            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Other Fields
        |--------------------------------------------------------------------------
        */

        setFormData(
            (previous) => ({
                ...previous,
                [name]: value,
            })
        );
        if (name === "gender") {
            setSchemeSelectionIsManual(false);
        }

        setFormError("");
    };


    /*
    |--------------------------------------------------------------------------
    | Submit
    |--------------------------------------------------------------------------
    */

    const buildPatientPayload = () => {
        setFormError("");


        /*
        |--------------------------------------------------------------------------
        | First Name
        |--------------------------------------------------------------------------
        */

        if (
            !formData.firstName.trim()
        ) {
            setFormError(
                "First name is required"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | DOB OR Age
        |--------------------------------------------------------------------------
        */

        if (
            !formData.dateOfBirth &&
            !formData.age
        ) {
            setFormError(
                "Date of birth or age is required"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Validate DOB
        |--------------------------------------------------------------------------
        */

        if (
            formData.dateOfBirth
        ) {
            const dateOfBirth =
                new Date(
                    `${formData.dateOfBirth}T00:00:00`
                );

            if (
                Number.isNaN(
                    dateOfBirth.getTime()
                ) ||
                dateOfBirth >
                    new Date()
            ) {
                setFormError(
                    "Date of birth must be a valid past date"
                );

                return;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Validate Age
        |--------------------------------------------------------------------------
        */

        const numericAge =
            Number(formData.age);

        if (
            formData.age === "" ||
            !Number.isInteger(
                numericAge
            ) ||
            numericAge < 0 ||
            numericAge > 150
        ) {
            setFormError(
                "Age must be a whole number between 0 and 150"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Gender
        |--------------------------------------------------------------------------
        */

        if (!formData.gender) {
            setFormError(
                "Gender is required"
            );

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


        /*
        |--------------------------------------------------------------------------
        | Phone
        |--------------------------------------------------------------------------
        */

        if (
            formData.phone.trim() &&
            !isValidPhone(
                formData.phone
            )
        ) {
            setFormError(
                "Enter a valid phone number (10 digits only)"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Alternate Phone
        |--------------------------------------------------------------------------
        */

        if (
            formData.alternatePhone &&
            !isValidPhone(
                formData.alternatePhone
            )
        ) {
            setFormError(
                "Enter a valid alternate phone number (10 digits only)"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Primary and Alternate Phone
        |--------------------------------------------------------------------------
        */

        if (
            formData.phone.trim() &&
            formData.alternatePhone &&
            formData.phone.replace(
                /\D/g,
                ""
            ) ===
                formData.alternatePhone.replace(
                    /\D/g,
                    ""
                )
        ) {
            setFormError(
                "Primary and alternate phone numbers cannot be the same"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Send Data to Parent
        |--------------------------------------------------------------------------
        */

        const {
            departmentId,
            visitType,
            opFee,
            ...patientFields
        } = formData;

        return {
            ...patientFields,
            age: numericAge,
            schemeId: selectedScheme
                ? Number(selectedScheme.id)
                : undefined,
            schemeAdditionalInformation: selectedScheme
                ? schemeAdditionalInformation.map(({ key, value }) => ({ key, value }))
                : [],
            departmentId,
            visitType,
            opFee,
        };
    };

    const handleOpTicket = (event) => {
        event.preventDefault();
        const payload = buildPatientPayload();

        if (!payload) {
            return;
        }

        if (!payload.departmentId) {
            setFormError("Please select a department");
            return;
        }

        if (visitHistory.hasVisitToday) {
            setFormError(
                "Patient has already registered an OP visit in this department today."
            );
            return;
        }

        const numericFee = Number(payload.opFee);

        if (
            payload.opFee === "" ||
            Number.isNaN(numericFee) ||
            numericFee < 0
        ) {
            setFormError("OP fee cannot be negative");
            return;
        }

        if (selectedScheme && !schemeEligibility.eligible) {
            setFormError(schemeEligibility.message);
            return;
        }
        if (eligibleSchemes.length > 1 && !selectedScheme) {
            setFormError("Multiple schemes match this patient. Select an eligible scheme to continue.");
            return;
        }

        onOpTicket({
            ...payload,
            opFee: numericFee,
            departmentId: Number(payload.departmentId),
            schemeId: selectedScheme ? Number(selectedScheme.id) : null,
            schemeAdditionalInformation: schemeAdditionalInformation.map(({ key, value }) => ({
                key,
                value,
            })),
        });
    };

    useEffect(() => {
        const syncDepartmentVisitState = async () => {
            if (!initialPatient?.id || !formData.departmentId) {
                setVisitHistory({
                    hasPreviousVisit: false,
                    hasVisitToday: false,
                    visitType: "NEW",
                    revisitCount: 0,
                });
                setFormData((previous) => (
                    previous.visitType === "NEW"
                        ? previous
                        : {
                            ...previous,
                            visitType: "NEW",
                        }
                ));
                return;
            }

            try {
                const response = await getPatientDepartmentVisitHistory(
                    initialPatient.id,
                    Number(formData.departmentId)
                );
                const history = response.data || {};
                const nextVisitType = history.visitType || "NEW";

                setVisitHistory(history);
                setFormData((previous) => ({
                    ...previous,
                    visitType: nextVisitType,
                }));

                if (history.hasVisitToday) {
                    setFormError(
                        "Patient has already registered an OP visit in this department today."
                    );
                } else {
                    setFormError("");
                }
            } catch (error) {
                setVisitHistory({
                    hasPreviousVisit: false,
                    hasVisitToday: false,
                    visitType: "NEW",
                    revisitCount: 0,
                });
                setFormError(
                    error.response?.data?.message ||
                    "Failed to load visit history"
                );
            }
        };

        syncDepartmentVisitState();
    }, [initialPatient?.id, formData.departmentId]);

    const selectedScheme = schemes.find(
        (scheme) => String(scheme.id) === String(formData.schemeId)
    ) || (
        formData.schemeId &&
        String(initialPatient?.scheme?.id) === String(formData.schemeId)
            && initialPatient.scheme.status !== "INACTIVE"
            ? initialPatient.scheme
            : null
    );
    const schemeEligibility = getSchemeEligibility(
        selectedScheme,
        formData.gender,
        formData.age === "" ? null : Number(formData.age)
    );
    const eligibleSchemes = schemes.filter((scheme) =>
        scheme.status !== "INACTIVE" &&
        getSchemeEligibility(
            scheme,
            formData.gender,
            formData.age === "" ? null : Number(formData.age)
        ).eligible
    );

    useEffect(() => {
        if (schemeSelectionIsManual) {
            return;
        }
        const nextSchemeId = eligibleSchemes.length === 1
            ? String(eligibleSchemes[0].id)
            : "";
        setFormData((previous) => previous.schemeId === nextSchemeId
            ? previous
            : { ...previous, schemeId: nextSchemeId }
        );
    }, [formData.gender, formData.age, schemes, schemeSelectionIsManual]);

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
    }, [selectedScheme?.id, selectedScheme?.additionalInformationFields, selectedScheme?.collectAdditionalInformation]);

    const numericFee = Number(formData.opFee) || 0;
    const discountAmount = selectedScheme && schemeEligibility.eligible ? numericFee : 0;
    const finalFee = numericFee - discountAmount;


    /*
    |--------------------------------------------------------------------------
    | UI
    |--------------------------------------------------------------------------
    */

    return (
        <form
            className="patient-form row g-3"
            onSubmit={handleOpTicket}
        >

            {(formError || serverError) && (
                <div className="form-error col-12">
                    {formError || serverError}
                </div>
            )}


            {/* ------------------------------------------------------------ */}
            {/* Name */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label className="required">
                        First name
                    </label>

                    <input
                        name="firstName"
                        value={
                            formData.firstName
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />
                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Middle name
                    </label>

                    <input
                        name="middleName"
                        value={
                            formData.middleName
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />
                </div>

            </div>

            {/* ------------------------------------------------------------ */}
            {/* Last Name + Gender */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Last name
                    </label>

                    <input
                        name="lastName"
                        value={
                            formData.lastName
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />
                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label className="required">
                        Gender
                    </label>

                    <select
                        name="gender"
                        value={
                            formData.gender
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                        required
                    >
                        <option value="">
                            Select gender
                        </option>

                        <option value="MALE">
                            Male
                        </option>

                        <option value="FEMALE">
                            Female
                        </option>

                        <option value="TRANSGENDER">
                            Transgender
                        </option>
                    </select>
                </div>

            </div>

            {eligibleSchemes.length > 1 && !selectedScheme && (
                <div className="scheme-eligibility-message ineligible col-12">
                    Multiple schemes match this patient. Choose one to continue:{" "}
                    {eligibleSchemes.map((scheme) => scheme.name).join(", ")}.
                </div>
            )}

            {selectedScheme && (
                <div className={`scheme-eligibility-message col-12 ${schemeEligibility.eligible ? "eligible" : "ineligible"}`}>
                    {schemeEligibility.eligible
                        ? `${selectedScheme.name} is eligible. A fixed 100% discount will be applied.`
                        : schemeEligibility.message}
                </div>
            )}

            {selectedScheme?.collectAdditionalInformation &&
                (selectedScheme.additionalInformationFields || []).length > 0 && (
                    <div className="scheme-patient-fields col-12">
                        <h4>Additional scheme information (optional)</h4>
                        <div className="row g-3">
                            {schemeAdditionalInformation.map((field) => (
                                <div className="form-group col-12 col-md-6 col-lg-4" key={field.key}>
                                    <label>{field.label}</label>
                                    <input
                                        type="text"
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


            {/* ------------------------------------------------------------ */}
            {/* DOB + Age */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label className="required">
                        Date of birth
                    </label>

                    <input
                        type="date"
                        name="dateOfBirth"
                        value={
                            formData.dateOfBirth
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />
                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label className="required">
                        Age
                    </label>

                    <input
                        type="number"
                        name="age"
                        value={
                            formData.age
                        }
                        onChange={
                            handleChange
                        }
                        min="0"
                        max="150"
                        step="1"
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Scheme & Email */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Scheme
                    </label>

                    <select
                        name="schemeId"
                        value={
                            formData.schemeId
                        }
                        onChange={
                            handleChange
                        }
                        disabled={
                            loading
                        }
                    >

                        <option value="" disabled={eligibleSchemes.length === 1}>
                            Select scheme
                        </option>

                        {schemes.map(
                            (scheme) => (
                                <option
                                    key={
                                        scheme.id
                                    }
                                    value={
                                        scheme.id
                                    }
                                >
                                    {scheme.name}
                                </option>
                            )
                        )}

                    </select>

                </div>

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Email
                    </label>

                    <input
                        type="email"
                        name="email"
                        value={
                            formData.email
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Phone */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Phone
                    </label>

                    <input
                        name="phone"
                        value={
                            formData.phone
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Alternate phone
                    </label>

                    <input
                        name="alternatePhone"
                        value={
                            formData.alternatePhone
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>

            {/* ------------------------------------------------------------ */}
            {/* Address 1 */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row full">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Address line 1
                    </label>

                    <input
                        name="addressLine1"
                        value={
                            formData.addressLine1
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Address 2 */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row full">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Address line 2
                    </label>

                    <input
                        name="addressLine2"
                        value={
                            formData.addressLine2
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* City + District */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        City
                    </label>

                    <input
                        name="city"
                        value={
                            formData.city
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        District
                    </label>

                    <select
                        name="district"
                        value={
                            formData.district
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    >

                        <option value="">
                            Select district
                        </option>

                        {KERALA_DISTRICTS.map(
                            (district) => (
                                <option
                                    key={
                                        district
                                    }
                                    value={
                                        district
                                    }
                                >
                                    {district}
                                </option>
                            )
                        )}

                    </select>

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* State + Country */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        State
                    </label>

                    <input
                        name="state"
                        value={
                            formData.state
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>


                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Country
                    </label>

                    <input
                        name="country"
                        value={
                            formData.country
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Postal Code */}
            {/* ------------------------------------------------------------ */}

            <div className="form-row">

                <div className="form-group col-12 col-md-6 col-lg-4">

                    <label>
                        Postal code
                    </label>

                    <input
                        name="postalCode"
                        value={
                            formData.postalCode
                        }
                        onChange={
                            handleChange
                        }
                        disabled={loading}
                    />

                </div>

            </div>


            <div className="form-row">
                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Department
                    </label>
                    <select
                        name="departmentId"
                        value={formData.departmentId}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        <option value="">
                            Select department
                        </option>
                        {departments
                            .filter((department) => department.status === "ACTIVE")
                            .map((department) => (
                                <option
                                    key={department.id}
                                    value={department.id}
                                >
                                    {department.name}
                                </option>
                            ))}
                    </select>
                </div>

                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Visit Type
                    </label>
                    <select
                        name="visitType"
                        value={formData.visitType}
                        disabled
                    >
                        <option value="NEW">
                            New Visit
                        </option>
                        <option value="REVISIT">
                            Revisit
                        </option>
                    </select>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        OP Fee
                    </label>
                    <input
                        type="number"
                        name="opFee"
                        min="0"
                        step="0.01"
                        value={formData.opFee}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>

                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Scheme Discount (100%)
                    </label>
                    <input
                        value={`₹${discountAmount.toFixed(2)}`}
                        readOnly
                        disabled
                    />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group col-12 col-md-6 col-lg-4">
                    <label>
                        Final Fee Amount
                    </label>
                    <input
                        value={`₹${finalFee.toFixed(2)}`}
                        readOnly
                        disabled
                    />
                </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Buttons */}
            {/* ------------------------------------------------------------ */}

            <div className="form-buttons col-12">
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || Boolean(selectedScheme && !schemeEligibility.eligible) || (eligibleSchemes.length > 1 && !selectedScheme)}
                >
                    {loading ? "Saving..." : "Register & Generate OP Ticket"}
                </button>

            </div>

        </form>
    );
}

export default PatientRegisterForm;
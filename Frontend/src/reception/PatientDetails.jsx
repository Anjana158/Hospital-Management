import { useEffect, useState } from "react";

import { updatePatient } from "./services/patientService";

import { useNavigate } from "react-router-dom";

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


/*
|--------------------------------------------------------------------------
| Format Date
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Convert Date to Input Value
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


/*
|--------------------------------------------------------------------------
| Display Value
|--------------------------------------------------------------------------
*/

function displayValue(value) {
    return (
        value === null ||
        value === undefined ||
        value === ""
    )
        ? "—"
        : value;
}


/*
|--------------------------------------------------------------------------
| Phone Validation
|--------------------------------------------------------------------------
*/

function isValidPhone(value) {
    if (!value) {
        return false;
    }

    if (
        !/^[+\d\s().-]+$/.test(
            value.trim()
        )
    ) {
        return false;
    }

    const digitCount =
        value.replace(/\D/g, "").length;

    return (
        digitCount >= 7 &&
        digitCount <= 15
    );
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
        new Date(
            `${dateString}T00:00:00`
        );

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
| Build Edit Form
|--------------------------------------------------------------------------
*/

function buildForm(patient) {
    return {
        firstName:
            patient.firstName || "",

        middleName:
            patient.middleName || "",

        lastName:
            patient.lastName || "",

        dateOfBirth:
            toDateInputValue(
                patient.dateOfBirth
            ),

        age:
            patient.age !== null &&
            patient.age !== undefined
                ? String(patient.age)
                : "",

        gender:
            patient.gender || "",

        phone:
            patient.phone || "",

        alternatePhone:
            patient.alternatePhone || "",

        email:
            patient.email || "",

        addressLine1:
            patient.addressLine1 || "",

        addressLine2:
            patient.addressLine2 || "",

        city:
            patient.city || "",

        district:
            patient.district || "",

        state:
            patient.state || "",

        postalCode:
            patient.postalCode || "",

        country:
            patient.country || "",

        schemeId:
            patient.scheme?.id
                ? String(
                    patient.scheme.id
                )
                : "",
    };
}


/*
|--------------------------------------------------------------------------
| Patient Details
|--------------------------------------------------------------------------
*/

function PatientDetails({
    patient,
    onBack,
    onAfterUpdate,
    schemes = [],
}) {

    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] =useState(() => buildForm(patient));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    /*
    |--------------------------------------------------------------------------
    | Update Form when Patient Changes
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        setFormData(
            buildForm(patient)
        );

        setIsEditing(false);
        setError("");
    }, [patient]);


    /*
    |--------------------------------------------------------------------------
    | Handle Changes
    |--------------------------------------------------------------------------
    */

    const handleChange = (
        event
    ) => {
        const {
            name,
            value,
        } = event.target;


        /*
        |--------------------------------------------------------------------------
        | DOB Changed
        |--------------------------------------------------------------------------
        */

        if (
            name === "dateOfBirth"
        ) {
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

            setError("");

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Age Changed
        |--------------------------------------------------------------------------
        */

        if (name === "age") {
            if (value === "") {
                setFormData(
                    (previous) => ({
                        ...previous,

                        age: "",
                        dateOfBirth: "",
                    })
                );

                setError("");

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

            setError("");

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

        setError("");
    };


    /*
    |--------------------------------------------------------------------------
    | Cancel Edit
    |--------------------------------------------------------------------------
    */

    const handleCancelEdit = () => {
        setFormData(
            buildForm(patient)
        );

        setIsEditing(false);
        setError("");
    };


    /*
    |--------------------------------------------------------------------------
    | Save
    |--------------------------------------------------------------------------
    */

    const handleSave = async (
        event
    ) => {
        event.preventDefault();

        setError("");


        /*
        |--------------------------------------------------------------------------
        | First Name
        |--------------------------------------------------------------------------
        */

        if (
            !formData.firstName.trim()
        ) {
            setError(
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
            setError(
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
                setError(
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
            setError(
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
            setError(
                "Gender is required"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Phone
        |--------------------------------------------------------------------------
        */

        if (
            !isValidPhone(
                formData.phone
            )
        ) {
            setError(
                "Enter a valid phone number (7–15 digits)"
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
            setError(
                "Enter a valid alternate phone number (7–15 digits)"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Same Phone Check
        |--------------------------------------------------------------------------
        */

        if (
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
            setError(
                "Primary and alternate phone numbers cannot be the same"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Payload
        |--------------------------------------------------------------------------
        */

        const payload = {
            firstName:
                formData.firstName.trim(),

            middleName:
                formData.middleName.trim(),

            lastName:
                formData.lastName.trim(),

            dateOfBirth:
                formData.dateOfBirth,

            age:
                numericAge,

            gender:
                formData.gender,

            phone:
                formData.phone.trim(),

            alternatePhone:
                formData.alternatePhone.trim(),

            email:
                formData.email.trim(),

            addressLine1:
                formData.addressLine1.trim(),

            addressLine2:
                formData.addressLine2.trim(),

            city:
                formData.city.trim(),

            district:
                formData.district.trim(),

            state:
                formData.state.trim(),

            postalCode:
                formData.postalCode.trim(),

            country:
                formData.country.trim(),

            schemeId:
                formData.schemeId
                    ? Number(
                        formData.schemeId
                    )
                    : "",
        };


        /*
        |--------------------------------------------------------------------------
        | Update API
        |--------------------------------------------------------------------------
        */

        try {
            setSaving(true);

            const result =
                await updatePatient(
                    patient.id,
                    payload
                );

            onAfterUpdate(
                result.data
            );

            setIsEditing(false);

        } catch (saveError) {

            if (
                saveError.response?.status ===
                    409 &&
                saveError.response?.data?.code ===
                    "PATIENT_DUPLICATE_PHONE"
            ) {
                const duplicates =
                    saveError.response
                        .data
                        .duplicates || [];

                const names =
                    duplicates
                        .map(
                            (item) =>
                                item.uhid ||
                                item.firstName
                        )
                        .filter(Boolean)
                        .join(", ");

                setError(
                    names
                        ? `Phone number already used by: ${names}`
                        : saveError.response
                            ?.data
                            ?.message ||
                            "Duplicate phone number"
                );

                return;
            }


            setError(
                saveError.response
                    ?.data
                    ?.message ||
                "Failed to update patient"
            );

        } finally {
            setSaving(false);
        }
    };


    /*
    |--------------------------------------------------------------------------
    | Full Name
    |--------------------------------------------------------------------------
    */

    const fullName = [
        patient.firstName,
        patient.middleName,
        patient.lastName,
    ]
        .filter(Boolean)
        .join(" ");


    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="patient-details-container">

            {/* ========================================================= */}
            {/* HEADER */}
            {/* ========================================================= */}

            <div className="patient-details-header">

                <div>
                    <h2>
                        {fullName ||
                            "Patient details"}
                    </h2>
                </div>


                <div className="patient-details-actions">

                    {!isEditing && (
                        <>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() =>
                                    setIsEditing(true)
                                }
                            >
                                Edit
                            </button>

                            {patient.status === "ACTIVE" && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() =>
                                        navigate(
                                            `/reception/op/${patient.id}`
                                        )
                                    }
                                >
                                    Register OP Visit
                                </button>
                            )}
                        </>
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


            {/* ========================================================= */}
            {/* ERROR */}
            {/* ========================================================= */}

            {error && (
                <div className="patient-error">
                    {error}
                </div>
            )}


            {/* ========================================================= */}
            {/* EDIT MODE */}
            {/* ========================================================= */}

            {isEditing ? (

                <form
                    className="patient-form"
                    onSubmit={
                        handleSave
                    }
                >

                    {/* ================================================= */}
                    {/* RECORD */}
                    {/* ================================================= */}

                    <div className="detail-section">

                        <h3>
                            Record
                        </h3>

                        <div className="detail-grid">

                            <div className="detail-item">

                                <label>
                                    UHID
                                </label>

                                <span>
                                    {
                                        patient.uhid
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Status
                                </label>

                                <span
                                    className={`status-badge ${
                                        patient.status ===
                                        "ACTIVE"
                                            ? "active"
                                            : "inactive"
                                    }`}
                                >
                                    {
                                        patient.status
                                    }
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* NAME */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* LAST NAME + GENDER */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
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


                    {/* ================================================= */}
                    {/* DOB + AGE */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                            <small>
                                Changing DOB will
                                automatically
                                update age.
                            </small>

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                            <small>
                                Changing age will
                                automatically
                                update DOB.
                            </small>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* SCHEME */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                    saving
                                }
                            >

                                <option value="">
                                    No scheme
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
                                            {
                                                scheme.name
                                            }
                                        </option>
                                    )
                                )}

                            </select>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* PHONE */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

                            <label className="required">
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
                                disabled={
                                    saving
                                }
                            />

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* EMAIL */}
                    {/* ================================================= */}

                    <div className="form-row full">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* ADDRESS */}
                    {/* ================================================= */}

                    <div className="form-row full">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    <div className="form-row full">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* CITY + DISTRICT */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            >

                                <option value="">
                                    Select district
                                </option>

                                {formData.district &&
                                    !KERALA_DISTRICTS.includes(
                                        formData.district
                                    ) && (
                                        <option
                                            value={
                                                formData.district
                                            }
                                        >
                                            {
                                                formData.district
                                            }
                                        </option>
                                    )}

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
                                            {
                                                district
                                            }
                                        </option>
                                    )
                                )}

                            </select>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* STATE + COUNTRY */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>


                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* POSTAL CODE */}
                    {/* ================================================= */}

                    <div className="form-row">

                        <div className="form-group">

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
                                disabled={
                                    saving
                                }
                            />

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* BUTTONS */}
                    {/* ================================================= */}

                    <div className="form-buttons">

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={
                                handleCancelEdit
                            }
                            disabled={
                                saving
                            }
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={
                                saving
                            }
                        >
                            {saving
                                ? "Saving..."
                                : "Save changes"}
                        </button>

                    </div>

                </form>

            ) : (

                /* ===================================================== */
                /* VIEW MODE */
                /* ===================================================== */

                <>

                    {/* ================================================= */}
                    {/* RECORD */}
                    {/* ================================================= */}

                    <div className="detail-section">

                        <h3>
                            Record
                        </h3>

                        <div className="detail-grid">

                            <div className="detail-item">

                                <label>
                                    UHID
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.uhid
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Status
                                </label>

                                <span
                                    className={`status-badge ${
                                        patient.status ===
                                        "ACTIVE"
                                            ? "active"
                                            : "inactive"
                                    }`}
                                >
                                    {
                                        displayValue(
                                            patient.status
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Scheme
                                </label>

                                <span className="category-badge">
                                    {
                                        patient.scheme
                                            ?.name ||
                                        "No scheme"
                                    }
                                </span>

                            </div>


                            {patient.scheme && (
                                <>

                                    <div className="detail-item">

                                        <label>
                                            Scheme code
                                        </label>

                                        <span>
                                            {
                                                displayValue(
                                                    patient
                                                        .scheme
                                                        .code
                                                )
                                            }
                                        </span>

                                    </div>


                                    <div className="detail-item">

                                        <label>
                                            Discount
                                        </label>

                                        <span>
                                            {patient.scheme.discountType ===
                                                "PERCENTAGE"
                                                ? `${patient.scheme.discountValue}%`
                                                : patient.scheme.discountType ===
                                                    "FIXED"
                                                    ? `₹${patient.scheme.discountValue}`
                                                    : "No discount"}
                                        </span>

                                    </div>

                                </>
                            )}


                            <div className="detail-item">

                                <label>
                                    Created
                                </label>

                                <span>
                                    {
                                        formatDate(
                                            patient.createdAt
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Updated
                                </label>

                                <span>
                                    {
                                        formatDate(
                                            patient.updatedAt
                                        )
                                    }
                                </span>

                            </div>


                            {patient.archivedAt && (
                                <div className="detail-item">

                                    <label>
                                        Archived
                                    </label>

                                    <span>
                                        {
                                            formatDate(
                                                patient.archivedAt
                                            )
                                        }
                                    </span>

                                </div>
                            )}

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* PERSONAL */}
                    {/* ================================================= */}

                    <div className="detail-section">

                        <h3>
                            Personal
                        </h3>

                        <div className="detail-grid">

                            <div className="detail-item">

                                <label>
                                    First name
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.firstName
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Middle name
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.middleName
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Last name
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.lastName
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Date of birth
                                </label>

                                <span>
                                    {
                                        formatDate(
                                            patient.dateOfBirth
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Age
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.age
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Gender
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.gender
                                        )
                                    }
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* CONTACT */}
                    {/* ================================================= */}

                    <div className="detail-section">

                        <h3>
                            Contact
                        </h3>

                        <div className="detail-grid">

                            <div className="detail-item">

                                <label>
                                    Phone
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.phone
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Alternate phone
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.alternatePhone
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Email
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.email
                                        )
                                    }
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* ================================================= */}
                    {/* ADDRESS */}
                    {/* ================================================= */}

                    <div className="detail-section">

                        <h3>
                            Address
                        </h3>

                        <div className="detail-grid">

                            <div className="detail-item">

                                <label>
                                    Address line 1
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.addressLine1
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Address line 2
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.addressLine2
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    City
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.city
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    District
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.district
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    State
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.state
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Postal code
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.postalCode
                                        )
                                    }
                                </span>

                            </div>


                            <div className="detail-item">

                                <label>
                                    Country
                                </label>

                                <span>
                                    {
                                        displayValue(
                                            patient.country
                                        )
                                    }
                                </span>

                            </div>

                        </div>

                    </div>

                </>

            )}

        </div>
    );
}

export default PatientDetails;
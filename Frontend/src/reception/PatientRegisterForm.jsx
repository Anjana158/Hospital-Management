import { useState } from "react";

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
};


/*
|--------------------------------------------------------------------------
| Phone Validation
|--------------------------------------------------------------------------
*/

function isValidPhone(value) {
    if (!value) {
        return false;
    }

    if (!/^[+\d\s().-]+$/.test(value.trim())) {
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

function PatientRegisterForm({
    onRegister,
    onCancel,
    loading,
    schemes = [],
    showDuplicates = false,
}) {
    const [formData, setFormData] =
        useState(emptyForm);

    const [formError, setFormError] =
        useState("");


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

        setFormError("");
    };


    /*
    |--------------------------------------------------------------------------
    | Submit
    |--------------------------------------------------------------------------
    */

    const handleSubmit = (
        event
    ) => {
        event.preventDefault();

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
            setFormError(
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
            setFormError(
                "Enter a valid alternate phone number (7–15 digits)"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Primary and Alternate Phone
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

        onRegister({
            ...formData,

            age:
                numericAge,

            schemeId:
                formData.schemeId
                    ? Number(
                        formData.schemeId
                    )
                    : undefined,
        });
    };


    /*
    |--------------------------------------------------------------------------
    | UI
    |--------------------------------------------------------------------------
    */

    return (
        <form
            className="patient-form"
            onSubmit={handleSubmit}
        >

            {formError && (
                <div className="form-error">
                    {formError}
                </div>
            )}


            {/* ------------------------------------------------------------ */}
            {/* Name */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Last Name + Gender */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
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


            {/* ------------------------------------------------------------ */}
            {/* DOB + Age */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
                    />
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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Scheme & Email */}
            {/* ------------------------------------------------------------ */}

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
                            loading
                        }
                    >

                        <option value="">
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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Phone */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
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
                        disabled={loading}
                    />

                </div>

            </div>

            {/* ------------------------------------------------------------ */}
            {/* Address 1 */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Address 2 */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* City + District */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
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
                        disabled={loading}
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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Postal Code */}
            {/* ------------------------------------------------------------ */}

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
                        disabled={loading}
                    />

                </div>

            </div>


            {/* ------------------------------------------------------------ */}
            {/* Buttons */}
            {/* ------------------------------------------------------------ */}

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
import { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaUserMd,
} from "react-icons/fa";

import {
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    getPatientById,
} from "./services/patientService";
import {
    getPatientAge,
    getSchemeEligibility,
} from "./utils/schemeEligibility";
import { getSchemes } from "../admin/services/schemeService";

import {
    getDepartments,
} from "../admin/services/departmentService";

import {
    getPatientDepartmentVisitHistory,
    registerVisit,
} from "./services/visitService";

import "../styles/OPRegistration.css";


function OPRegistration() {

    const navigate =
        useNavigate();
    const location = useLocation();

    const { patientId } =
        useParams();
    const returnTo = location.state?.returnTo || "/reception/registered-patients";


    const [patient, setPatient] =
        useState(null);

    const [departments, setDepartments] =
        useState([]);
    const [activeSchemes, setActiveSchemes] = useState([]);
    const [selectedSchemeId, setSelectedSchemeId] = useState("");


    const [departmentId, setDepartmentId] =
        useState("");

    const [visitType, setVisitType] =
        useState("NEW");

    const [visitHistory, setVisitHistory] =
        useState({
            hasPreviousVisit: false,
            hasVisitToday: false,
            visitType: "NEW",
            revisitCount: 0,
        });

    const opFee = 10;
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [authCode, setAuthCode] = useState("");
    const [schemeAdditionalInformation, setSchemeAdditionalInformation] = useState([]);


    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");
    
    /*
    |--------------------------------------------------------------------------
    | Load Data
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        loadData();
    }, [patientId]);


    const loadData =
        async () => {

            try {

                setLoading(true);
                setError("");


                const [
                    patientResult,
                    departmentResult,
                    schemesResult,
                ] = await Promise.all([
                    getPatientById(patientId),
                    getDepartments(),
                    getSchemes(),
                ]);

                const loadedPatient = patientResult.data;
                const loadedSchemes = schemesResult.data || [];
                const eligibleSchemes = loadedSchemes.filter((scheme) =>
                    getSchemeEligibility(
                        scheme,
                        loadedPatient.gender,
                        getPatientAge(loadedPatient)
                    ).eligible
                );
                setPatient(loadedPatient);
                setDepartments(departmentResult.departments || []);
                setActiveSchemes(loadedSchemes);
                const patientSchemeId = String(
                    loadedPatient.scheme?.id || loadedPatient.schemeId || ""
                );
                const patientScheme = eligibleSchemes.find(
                    (scheme) => String(scheme.id) === patientSchemeId
                );
                const nextSchemeId = patientScheme
                    ? patientScheme.id
                    : eligibleSchemes.length === 1
                        ? eligibleSchemes[0].id
                        : "";
                setSelectedSchemeId(
                    nextSchemeId ? String(nextSchemeId) : ""
                );

            } catch (error) {

                console.error(
                    "Failed to load OP registration data:",
                    error
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                    "Failed to load OP registration data"
                );

            } finally {

                setLoading(false);
            }
        };


    /*
    |--------------------------------------------------------------------------
    | Department Change
    |--------------------------------------------------------------------------
    */

    const handleDepartmentChange =
        (event) => {

            const value =
                event.target.value;

            setDepartmentId(value);
            setVisitHistory({
                hasPreviousVisit: false,
                hasVisitToday: false,
                visitType: "NEW",
                revisitCount: 0,
            });
            setError("");
        };

    useEffect(() => {
        const syncDepartmentVisitState = async () => {
            if (!patientId || !departmentId) {
                setVisitHistory({
                    hasPreviousVisit: false,
                    hasVisitToday: false,
                    visitType: "NEW",
                    revisitCount: 0,
                });
                setVisitType("NEW");
                return;
            }

            try {
                const response = await getPatientDepartmentVisitHistory(
                    Number(patientId),
                    Number(departmentId)
                );

                const history = response.data || {};
                const nextVisitType = history.visitType || "NEW";

                setVisitHistory(history);
                setVisitType(nextVisitType);

                if (history.hasVisitToday) {
                    setError("Patient has already registered an OP visit in this department today.");
                } else {
                    setError("");
                }
            } catch (error) {
                console.error("Failed to load patient visit history:", error);
                setVisitType("NEW");
                setVisitHistory({
                    hasPreviousVisit: false,
                    hasVisitToday: false,
                    visitType: "NEW",
                    revisitCount: 0,
                });
                setError(
                    error.response?.data?.message ||
                    "Failed to load visit history"
                );
            }
        };

        syncDepartmentVisitState();
    }, [patientId, departmentId]);


    /*
    |--------------------------------------------------------------------------
    | Selected Scheme
    |--------------------------------------------------------------------------
    */

    const scheme = activeSchemes.find(
        (candidate) => String(candidate.id) === selectedSchemeId
    ) || null;

    const schemeEligibility = scheme
        ? getSchemeEligibility(scheme, patient?.gender, getPatientAge(patient))
        : { eligible: true, message: "" };

    useEffect(() => {
        const fields = scheme?.collectAdditionalInformation
            ? scheme.additionalInformationFields || []
            : [];
        const previousValues = new Map(
            (String(patient?.scheme?.id) === String(scheme?.id)
                ? patient?.schemeAdditionalInformation || []
                : []).map((field) => [field.key, field.value])
        );
        setSchemeAdditionalInformation(fields.map((field) => ({
            key: field.key,
            label: field.label,
            value: previousValues.get(field.key) ?? "",
        })));
    }, [patient?.id, scheme?.id, scheme?.additionalInformationFields, scheme?.collectAdditionalInformation]);


    const numericFee =
        Number(opFee) || 0;


    const discountAmount = scheme && schemeEligibility.eligible ? numericFee : 0;
    const finalFee = numericFee - discountAmount;


    /*
    |--------------------------------------------------------------------------
    | Register
    |--------------------------------------------------------------------------
    */

    const handleSubmit =
        async (event) => {

            event.preventDefault();

            setError("");


            if (!departmentId) {

                setError(
                    "Please select a department"
                );

                return;
            }

            if (scheme && !schemeEligibility.eligible) {
                setError(schemeEligibility.message);
                return;
            }


            if (visitHistory.hasVisitToday) {
                setError(
                    "Patient has already registered an OP visit in this department today."
                );
                return;
            }


            if (
                numericFee < 0
            ) {

                setError(
                    "OP fee cannot be negative"
                );

                return;
            }

            if (
                finalFee > 0 &&
                paymentMethod === "POS" &&
                !authCode.trim()
            ) {
                setError("Auth Code is required for POS payments.");
                return;
            }


            try {

                setSaving(true);

                const result =
                    await registerVisit({
                        patientId:
                            Number(
                                patientId
                            ),

                        departmentId:
                            Number(
                                departmentId
                            ),

                        schemeId: selectedSchemeId ? Number(selectedSchemeId) : null,
                        opFee:
                            numericFee,

                        paymentMethod:
                            finalFee > 0 ? paymentMethod : null,

                        authCode:
                            finalFee > 0 && paymentMethod === "POS"
                                ? authCode.trim()
                                : undefined,

                        schemeAdditionalInformation:
                            schemeAdditionalInformation.map(({ key, value }) => ({
                                key,
                                value,
                            })),
                    });

                navigate(
                    `/reception/op-ticket/${result.data.visit.id}`,
                    {
                        state: {
                            visit:
                                result.data.visit,

                            tokenNumber:
                                result.data.tokenNumber,

                            tokenLabel:
                                result.data.tokenLabel,

                            autoPrint: true,

                            returnTo,
                        },
                    }
                );

            } catch (error) {

                console.error(
                    "OP registration error:",
                    error
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                    "Failed to register OP visit"
                );

            } finally {

                setSaving(false);
            }
        };


    /*
    |--------------------------------------------------------------------------
    | Patient Name
    |--------------------------------------------------------------------------
    */

    const patientName = patient?.firstName || "";


    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (loading) {

        return (
            <div className="op-registration-page reception-page">

                <div className="op-loading">
                    Loading OP registration...
                </div>

            </div>
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Error / No Patient
    |--------------------------------------------------------------------------
    */

    if (!patient) {

        return (
            <div className="op-registration-page reception-page">

                <div className="op-error">
                    {error ||
                        "Patient not found"}
                </div>

                <button
                    className="op-secondary-btn"
                    onClick={() =>
                        navigate(
                            returnTo
                        )
                    }
                >
                    <FaArrowLeft />
                    Back to Patients
                </button>

            </div>
        );
    }


    return (
        <div className="op-registration-page reception-page">

            {/* ===================================================== */}
            {/* HEADER */}
            {/* ===================================================== */}

            <header className="op-page-header reception-page-header">
                <h1>OP Registration</h1>

                <button
                    className="op-secondary-btn"
                    onClick={() =>
                        navigate(
                            returnTo
                        )
                    }
                    disabled={saving}
                >
                    <FaArrowLeft />
                    Back
                </button>

            </header>


            {/* ===================================================== */}
            {/* ERROR */}
            {/* ===================================================== */}

            {error && (
                <div className="op-error">
                    {error}
                </div>
            )}


            {/* ===================================================== */}
            {/* PATIENT SUMMARY */}
            {/* ===================================================== */}

            <div className="op-card">

                <div className="op-card-header">

                    <div>
                        <h3>
                            Patient Information
                        </h3>

                        <p>
                            Confirm patient before OP registration
                        </p>
                    </div>

                    <FaUserMd />

                </div>


                <div className="op-patient-grid">

                    <div className="op-detail">

                        <label>
                            UHID
                        </label>

                        <strong>
                            {patient.uhid}
                        </strong>

                    </div>


                    <div className="op-detail">

                        <label>
                            Patient Name
                        </label>

                        <strong>
                            {patientName}
                        </strong>

                    </div>


                    <div className="op-detail">

                        <label>
                            Age
                        </label>

                        <strong>
                            {patient.age}
                        </strong>

                    </div>


                    <div className="op-detail">

                        <label>
                            Gender
                        </label>

                        <strong>
                            {patient.gender}
                        </strong>

                    </div>


                    <div className="op-detail">

                        <label>
                            Phone
                        </label>

                        <strong>
                            {patient.phone}
                        </strong>

                    </div>


                    <div className="op-detail">

                        <label>
                            Scheme
                        </label>

                        <strong>
                            {scheme?.name ||
                                "No scheme"}
                        </strong>

                    </div>

                </div>

            </div>


            {/* ===================================================== */}
            {/* OP FORM */}
            {/* ===================================================== */}

            <form
                className="op-card"
                onSubmit={handleSubmit}
            >

                <div className="op-card-header">

                    <div>
                        <h3>
                            Visit Information
                        </h3>

                        <p>
                            Select a department. Visit type is determined from this patient’s visit history.
                        </p>
                    </div>

                </div>


                <div className="op-form-grid">

                    {/* Department */}

                    <div className="op-form-group">

                        <label>
                            Department
                            <span>*</span>
                        </label>

                        <select
                            value={
                                departmentId
                            }
                            onChange={
                                handleDepartmentChange
                            }
                            disabled={
                                saving
                            }
                        >

                            <option value="">
                                Select department
                            </option>

                            {departments
                                .filter(
                                    (department) =>
                                        department.status ===
                                        "ACTIVE"
                                )
                                .map(
                                    (department) => (
                                        <option
                                            key={
                                                department.id
                                            }
                                            value={
                                                department.id
                                            }
                                        >
                                            {
                                                department.name
                                            }
                                        </option>
                                    )
                                )}

                        </select>

                    </div>


                    {/* Visit Type */}

                    <div className="op-form-group">

                        <label>
                            Visit Type
                            <span>*</span>
                        </label>

                        <select
                            value={
                                visitType
                            }
                            disabled={true}
                        >

                            <option value="NEW">
                                New Visit
                            </option>

                            <option value="REVISIT">
                                Revisit
                            </option>

                        </select>

                    </div>


                    {/* OP Fee */}

                    <div className="op-form-group">

                        <label>
                            OP Fee
                        </label>

                        <input
                            type="number"
                            value={
                                opFee
                            }
                            readOnly
                            disabled
                        />

                    </div>

                </div>

                <div className="op-form-group">
                    <label>Scheme (optional)</label>
                    <select
                        value={selectedSchemeId}
                        onChange={(event) => setSelectedSchemeId(event.target.value)}
                        disabled={saving}
                    >
                        <option value="">No scheme</option>
                        {activeSchemes.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                </div>

                {scheme && (
                    <div className={`op-scheme-message ${schemeEligibility.eligible ? "eligible" : "ineligible"}`}>
                        {schemeEligibility.eligible
                            ? `${scheme.name} is eligible. A fixed 100% discount will be applied.`
                            : schemeEligibility.message}
                    </div>
                )}

                {scheme &&
                    scheme.collectAdditionalInformation &&
                    schemeAdditionalInformation.length > 0 && (
                        <div className="op-scheme-fields">
                            <h4>Additional scheme information (optional)</h4>
                            <div className="op-form-grid">
                                {schemeAdditionalInformation.map((field) => (
                                    <div className="op-form-group" key={field.key}>
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
                                            disabled={saving}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                {/* ================================================= */}
                {/* FEE SUMMARY */}
                {/* ================================================= */}

                <div className="op-fee-summary">

                    <div className="op-fee-row">
                        <span>
                            OP Fee
                        </span>

                        <strong>
                            ₹
                            {numericFee.toFixed(2)}
                        </strong>
                    </div>


                    <div className="op-fee-row">
                        <span>
                            Scheme Discount (100%)
                        </span>

                        <strong>
                            ₹
                            {discountAmount.toFixed(
                                2
                            )}
                        </strong>
                    </div>


                    <div className="op-fee-row op-final-fee">
                        <span>
                            Final Fee
                        </span>

                        <strong>
                            ₹
                            {finalFee.toFixed(
                                2
                            )}
                        </strong>

                    </div>

                    <div className="op-payment-grid">
                        <div className="op-form-group">
                            <label htmlFor="op-payment-method">Payment Method</label>
                            {finalFee > 0 ? (
                                <select
                                    id="op-payment-method"
                                    value={paymentMethod}
                                    onChange={(event) => {
                                        const nextMethod = event.target.value;
                                        setPaymentMethod(nextMethod);
                                        if (nextMethod !== "POS") setAuthCode("");
                                    }}
                                    disabled={saving || (scheme && !schemeEligibility.eligible)}
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="POS">POS</option>
                                </select>
                            ) : (
                                <div className="op-payment-free">
                                    FREE - No payment required
                                </div>
                            )}
                        </div>

                        {finalFee > 0 && paymentMethod === "POS" && (
                            <div className="op-form-group">
                                <label htmlFor="op-auth-code">
                                    Auth Code
                                    <span>*</span>
                                </label>
                                <input
                                    id="op-auth-code"
                                    type="text"
                                    value={authCode}
                                    onChange={(event) => setAuthCode(event.target.value)}
                                    disabled={saving}
                                    required
                                />
                            </div>
                        )}
                    </div>

                </div>


                {/* ================================================= */}
                {/* BUTTONS */}
                {/* ================================================= */}

                <div className="op-form-actions">

                    <button
                        type="button"
                        className="op-secondary-btn"
                        onClick={() =>
                            navigate(
                                returnTo
                            )
                        }
                        disabled={saving}
                    >
                        Cancel
                    </button>


                    <button
                        type="submit"
                        className="op-primary-btn"
                        disabled={saving || Boolean(scheme && !schemeEligibility.eligible)}
                    >
                        <FaCheckCircle />

                        {saving
                            ? "Registering..."
                            : "Register OP"}
                    </button>

                </div>

            </form>

        </div>
    );
}


export default OPRegistration;
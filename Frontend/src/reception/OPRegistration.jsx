import { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaHospital,
    FaUserMd,
} from "react-icons/fa";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    getPatientById,
} from "./services/patientService";

import {
    getDepartments,
} from "../admin/services/departmentService";

import {
    getDoctors,
} from "../admin/services/doctorService";

import {
    getPatientDoctorVisitHistory,
    registerVisit,
} from "./services/visitService";

import "../styles/OPRegistration.css";


function OPRegistration() {

    const navigate =
        useNavigate();

    const { patientId } =
        useParams();


    const [patient, setPatient] =
        useState(null);

    const [departments, setDepartments] =
        useState([]);

    const [doctors, setDoctors] =
        useState([]);


    const [departmentId, setDepartmentId] =
        useState("");

    const [doctorId, setDoctorId] =
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

    const [opFee, setOpFee] = useState("10");


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
                    doctorResult,
                ] = await Promise.all([
                    getPatientById(patientId),
                    getDepartments(),
                    getDoctors(),
                ]);


                setPatient(
                    patientResult.data
                );


                setDepartments(
                    departmentResult.departments ||
                    []
                );


                setDoctors(
                    doctorResult.doctors ||
                    []
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
            setDoctorId("");
            setVisitHistory({
                hasPreviousVisit: false,
                hasVisitToday: false,
                visitType: "NEW",
                revisitCount: 0,
            });
            setError("");
        };

    useEffect(() => {
        const syncDoctorVisitState = async () => {
            if (!patientId || !doctorId) {
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
                const response = await getPatientDoctorVisitHistory(
                    Number(patientId),
                    Number(doctorId)
                );

                const history = response.data || {};
                const nextVisitType = history.visitType || "NEW";

                setVisitHistory(history);
                setVisitType(nextVisitType);

                if (history.hasVisitToday) {
                    setError("Patient has already registered an OP visit with this doctor today.");
                } else {
                    setError("");
                }
            } catch (error) {
                console.error("Failed to load patient-doctor visit history:", error);
                setVisitType("NEW");
                setVisitHistory({
                    hasPreviousVisit: false,
                    hasVisitToday: false,
                    visitType: "NEW",
                    revisitCount: 0,
                });
                setError(
                    error.response?.data?.message ||
                    "Failed to load doctor visit history"
                );
            }
        };

        syncDoctorVisitState();
    }, [patientId, doctorId]);


    /*
    |--------------------------------------------------------------------------
    | Filter Doctors
    |--------------------------------------------------------------------------
    */

    const filteredDoctors =
        doctors.filter(
            (doctor) =>
                doctor.status ===
                    "ACTIVE" &&
                String(
                    doctor.departmentId
                ) ===
                    String(
                        departmentId
                    )
        );


    /*
    |--------------------------------------------------------------------------
    | Selected Scheme
    |--------------------------------------------------------------------------
    */

    const scheme =
        patient?.scheme;


    const numericFee =
        Number(opFee) || 0;


    let discountAmount = 0;


    if (
        scheme &&
        scheme.status === "ACTIVE"
    ) {

        if (
            scheme.discountType ===
            "PERCENTAGE"
        ) {

            discountAmount =
                (
                    numericFee *
                    Number(
                        scheme.discountValue
                    )
                ) / 100;

        } else if (
            scheme.discountType ===
            "FIXED"
        ) {

            discountAmount =
                Number(
                    scheme.discountValue
                );
        }
    }


    discountAmount =
        Math.min(
            discountAmount,
            numericFee
        );


    const finalFee =
        numericFee -
        discountAmount;


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


            if (!doctorId) {

                setError(
                    "Please select a doctor"
                );

                return;
            }

            if (visitHistory.hasVisitToday) {
                setError(
                    "Patient has already registered an OP visit with this doctor today."
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

                        doctorId:
                            Number(
                                doctorId
                            ),

                        opFee:
                            numericFee,
                    });

                navigate(
                    `/reception/op-ticket/${result.data.visit.id}`,
                    {
                        state: {
                            visit:
                                result.data.visit,

                            tokenNumber:
                                result.data.tokenNumber,
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

    const patientName =
        patient
            ? [
                patient.firstName,
                patient.middleName,
                patient.lastName,
            ]
                .filter(Boolean)
                .join(" ")
            : "";


    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (loading) {

        return (
            <div className="op-registration-page">

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
            <div className="op-registration-page">

                <div className="op-error">
                    {error ||
                        "Patient not found"}
                </div>

                <button
                    className="op-secondary-btn"
                    onClick={() =>
                        navigate(
                            "/reception/patients"
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
        <div className="op-registration-page">

            {/* ===================================================== */}
            {/* HEADER */}
            {/* ===================================================== */}

            <div className="op-page-header">

                <div className="op-page-title">

                    <div className="op-title-icon">
                        <FaHospital />
                    </div>

                    <div>
                        <h2>
                            OP Registration
                        </h2>

                        <p>
                            Register an outpatient visit
                        </p>
                    </div>

                </div>


                <button
                    className="op-secondary-btn"
                    onClick={() =>
                        navigate(
                            "/reception/patients"
                        )
                    }
                    disabled={saving}
                >
                    <FaArrowLeft />
                    Back
                </button>

            </div>


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
                            Select department, doctor and visit type
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


                    {/* Doctor */}

                    <div className="op-form-group">

                        <label>
                            Doctor
                            <span>*</span>
                        </label>

                        <select
                            value={
                                doctorId
                            }
                            onChange={(event) => {
                                setDoctorId(
                                    event.target.value
                                );
                                setError("");
                            }}
                            disabled={
                                saving ||
                                !departmentId
                            }
                        >

                            <option value="">
                                {!departmentId
                                    ? "Select department first"
                                    : "Select doctor"}
                            </option>

                            {filteredDoctors.map(
                                (doctor) => (
                                    <option
                                        key={
                                            doctor.id
                                        }
                                        value={
                                            doctor.id
                                        }
                                    >
                                        Dr.{" "}
                                        {
                                            doctor.fullName
                                        }
                                        {doctor.specialization
                                            ? ` - ${doctor.specialization}`
                                            : ""}
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
                            min="0"
                            step="0.01"
                            value={
                                opFee
                            }
                            onChange={(event) =>setOpFee(event.target.value)}
                            disabled={
                                saving
                            }
                        />

                    </div>

                </div>


                {/* ================================================= */}
                {/* FEE SUMMARY */}
                {/* ================================================= */}

                <div className="op-fee-summary">

                    <div>
                        <span>
                            OP Fee
                        </span>

                        <strong>
                            ₹
                            {numericFee.toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <span>
                            Scheme Discount
                        </span>

                        <strong>
                            ₹
                            {discountAmount.toFixed(
                                2
                            )}
                        </strong>
                    </div>


                    <div className="op-final-fee">

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
                                "/reception/patients"
                            )
                        }
                        disabled={saving}
                    >
                        Cancel
                    </button>


                    <button
                        type="submit"
                        className="op-primary-btn"
                        disabled={saving}
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
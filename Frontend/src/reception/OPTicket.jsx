import {
    FaArrowLeft,
    FaPrint,
} from "react-icons/fa";

import {
    useLocation,
    useNavigate,
} from "react-router-dom";

import "../styles/OPTicket.css";


function OPTicket() {

    const navigate = useNavigate();
    const location = useLocation();

    const visit = location.state?.visit;
    const tokenNumber = location.state?.tokenNumber;


    /*
    |--------------------------------------------------------------------------
    | No Visit Data
    |--------------------------------------------------------------------------
    */

    if (!visit) {

        return (
            <div className="op-ticket-page">

                <div className="op-ticket-error">

                    <h2>
                        OP Ticket unavailable
                    </h2>

                    <p>
                        The OP registration details
                        are not available on this page.
                    </p>

                    <button
                        className="ticket-back-btn"
                        onClick={() =>
                            navigate("/reception/patients")
                        }
                    >
                        <FaArrowLeft />
                        Back to Patients
                    </button>

                </div>

            </div>
        );
    }


    const patient = visit.patient;
    const department = visit.department;


    /*
    |--------------------------------------------------------------------------
    | Patient Name
    |--------------------------------------------------------------------------
    */

    const patientName = [
        patient?.firstName,
        patient?.middleName,
        patient?.lastName,
    ]
        .filter(Boolean)
        .join(" ");


    /*
    |--------------------------------------------------------------------------
    | Gender
    |--------------------------------------------------------------------------
    */

    const gender =
        patient?.gender === "MALE"
            ? "Male"
            : patient?.gender === "FEMALE"
                ? "Female"
                : patient?.gender === "TRANSGENDER"
                    ? "Transgender"
                    : "";


    /*
    |--------------------------------------------------------------------------
    | Date + Time
    |--------------------------------------------------------------------------
    */

    const formatVisitDateTime = (value) => {

        if (!value) {
            return "—";
        }

        const date = new Date(value);

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const year = date.getFullYear();

        const hours = String(
            date.getHours()
        ).padStart(2, "0");

        const minutes = String(
            date.getMinutes()
        ).padStart(2, "0");

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };


    /*
    |--------------------------------------------------------------------------
    | Print
    |--------------------------------------------------------------------------
    */

    const printTicket = () => {
        window.print();
    };


    return (

        <div className="op-ticket-page">

            {/* =====================================================
                PAGE ACTIONS
            ===================================================== */}

            <div className="op-ticket-actions no-print">

                <button
                    className="ticket-back-btn"
                    onClick={() =>
                        navigate("/reception/patients")
                    }
                >
                    <FaArrowLeft />
                    Back
                </button>


                <button
                    className="ticket-print-btn"
                    onClick={printTicket}
                >
                    <FaPrint />
                    Print OP Ticket
                </button>

            </div>


            {/* =====================================================
                PRINTABLE OP TICKET
            ===================================================== */}

            <div className="op-ticket">

                {/* =================================================
                    TOP INFORMATION / HEADER
                ================================================= */}

                <div className="ticket-header-section">


                    {/* ---------------------------------------------
                        HOSPITAL NAME
                    --------------------------------------------- */}

                    <div className="hospital-heading">

                        <div className="hospital-name">
                            GENERAL HOSPITAL THRISSUR
                        </div>

                        <div className="hospital-address">
                            GH THRISSUR, THRISSUR- 680001,
                            Ph: 04872427383
                        </div>

                    </div>


                    {/* ---------------------------------------------
                        OP CARD
                    --------------------------------------------- */}

                    <div className="op-card-title">
                        OP Card
                    </div>


                    {/* =================================================
                        PATIENT / VISIT INFORMATION
                    ================================================= */}

                    <div className="ticket-information">


                        {/* ---------------------------------------------
                            LEFT COLUMN
                        --------------------------------------------- */}

                        <div className="ticket-left-column">
                            <div className="ticket-row">
                                <span className="ticket-label">
                                    UHID
                                </span>

                                <span className="ticket-value">
                                    : {patient?.uhid || "—"}
                                </span>

                            </div>


                            <div className="ticket-row">

                                <span className="ticket-label">
                                    Name
                                </span>

                                <span className="ticket-value">
                                    : {patientName || "—"}
                                    {patient?.age !== undefined &&
                                    patient?.age !== null
                                        ? `, ${patient.age} Y O D`
                                        : ""}
                                    {gender
                                        ? `, ${gender}`
                                        : ""}
                                </span>

                            </div>


                            <div className="ticket-row">

                                <span className="ticket-label">
                                    Address
                                </span>

                                <span className="ticket-value">
                                    : {patient?.addressLine1 ||
                                        patient?.addressLine2 ||
                                        patient?.city ||
                                        patient?.district ||
                                        "—"}
                                </span>

                            </div>


                            <div className="ticket-row">

                                <span className="ticket-label">
                                    Clinic
                                </span>

                                <span className="ticket-value">
                                    : {department?.name || "—"}
                                </span>

                            </div>

                        </div>


                        {/* ---------------------------------------------
                            RIGHT COLUMN
                        --------------------------------------------- */}

                        <div className="ticket-right-column">


                            <div className="ticket-row">

                                <span className="ticket-label">
                                    Visit Date
                                </span>

                                <span className="ticket-value">
                                    : {formatVisitDateTime(
                                        visit.visitDate
                                    )}
                                </span>

                            </div>


                            <div className="ticket-row">

                                <span className="ticket-label">
                                    Mobile
                                </span>

                                <span className="ticket-value">
                                    : {patient?.phone || "—"}
                                </span>

                            </div>


                            <div className="ticket-row">
                                <span className="ticket-label">Unit</span>
                                <span className="ticket-value">: {department?.code || department?.name ||"—"}</span>
                            </div>

                            <div className="ticket-row">

                                <span className="ticket-label">
                                    OPD No.
                                </span>

                                <span className="ticket-value">
                                    : {visit.visitNumber || "—"}
                                </span>

                            </div>

                            <div className="op-days">OP Days[MON,TUE,WED,THU,FRI,SAT,SUN]</div>
                        </div>

                    </div>


                    {/* =================================================
                        TOKEN NUMBER
                    ================================================= */}

                    <div className="token-row">

                        <span className="token-label">
                            Token No.
                        </span>

                        <span className="token-number">
                            {tokenNumber || "—"}
                        </span>

                    </div>


                    {/* =================================================
                        VISIT CHARGE
                    ================================================= */}

                    <div className="visit-charge-row">

                        <span>
                            Visit Charge:
                        </span>

                        <span>
                            Paid Rs.{" "}
                            {Number(
                                visit.finalFee ?? visit.opFee ?? 0
                            ).toFixed(2)}
                        </span>

                    </div>

                </div>


                {/* =====================================================
                    DOCTOR PRESCRIPTION AREA
                ===================================================== */}

                <div className="ticket-prescription-area">

                    {/* Intentionally blank.
                        This area is for the doctor to prescribe
                        medicines / write notes. */}

                </div>


                {/* =====================================================
                    PRINTED DATE
                ===================================================== */}

                <div className="ticket-printed-date">

                    Printed date :
                    {" "}
                    {formatVisitDateTime(
                        visit.visitDate
                    )}

                </div>

            </div>

        </div>
    );
}


export default OPTicket;
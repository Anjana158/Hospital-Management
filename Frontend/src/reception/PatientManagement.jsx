import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";

import {
    searchPatients,
    getPatientById,
    registerPatient,
    getPatientSchemes,
} from "./services/patientService";

import {
    getTodayVisits,
} from "./services/visitService";

import "../styles/PatientManagement.css";
import PatientRegisterForm from "./PatientRegisterForm";
import PatientDetails from "./PatientDetails";

function PatientManagement() {
    const [view, setView] = useState("search");

    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState("all");
    const [searchResults, setSearchResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [selectedPatient, setSelectedPatient] = useState(null);

    const [showRegisterModal, setShowRegisterModal] = useState(false);

    const [duplicateCandidates, setDuplicateCandidates] = useState([]);

    const [todayVisits, setTodayVisits] = useState([]);

    const [todayPagination, setTodayPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
    });

    /*
    |--------------------------------------------------------------------------
    | Schemes
    |--------------------------------------------------------------------------
    */

    const [schemes, setSchemes] = useState([]);


    /*
    |--------------------------------------------------------------------------
    | Load Active Schemes
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        loadSchemes();
        loadTodayVisits();
    }, []);

    const loadSchemes = async () => {
        try {
            const result =
                await getPatientSchemes();

            setSchemes(
                result.data || []
            );
        } catch (error) {
            console.error(
                "Failed to load schemes:",
                error
            );

            setSchemes([]);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Load Today's OP Visits
    |--------------------------------------------------------------------------
    */

    const loadTodayVisits = async (
        page = 1,
        limit = 20
    ) => {
        try {
            setLoading(true);
            setError("");

            const result =
                await getTodayVisits(
                    page,
                    limit
                );

            setTodayVisits(
                result.data?.items || []
            );

            setTodayPagination(
                result.data?.pagination || {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                }
            );
        } catch (error) {
            console.error(
                "Failed to load today's OP visits:",
                error
            );

            setError(
                error.response?.data?.message ||
                "Failed to load today's OP visits"
            );

            setTodayVisits([]);
        } finally {
            setLoading(false);
        }
    };


    /*
    |--------------------------------------------------------------------------
    | Search Patients
    |--------------------------------------------------------------------------
    */

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!searchQuery.trim()) {
            setError("Please enter a search query");
            setHasSearched(false);
            setSearchResults([]);
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSuccess("");
            setHasSearched(false);

            const result = await searchPatients(
                searchQuery,
                searchField,
                1,
                20
            );

            const results = result.data?.items || [];

            setSearchResults(results);
            setHasSearched(true);

            if (results.length === 0) {
                setError("No patients found matching your search");
            }
        } catch (error) {
            console.error("Search error:", error);

            setSearchResults([]);
            setHasSearched(false);

            setError(
                error.response?.data?.message ||
                "Failed to search patients"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setSearchResults([]);
        setHasSearched(false);
        setError("");
        setSuccess("");

        loadTodayVisits(1, 20);
    };

    /*
    |--------------------------------------------------------------------------
    | View Patient Details
    |--------------------------------------------------------------------------
    */

    const viewPatientDetails = async (
        patientId
    ) => {
        try {
            setLoading(true);
            setError("");
            setSuccess("");

            const result =
                await getPatientById(
                    patientId
                );

            setSelectedPatient(
                result.data
            );

            setView("details");
        } catch (error) {
            console.error(
                "Failed to load patient details:",
                error
            );

            setError(
                error.response?.data?.message ||
                "Failed to load patient details"
            );
        } finally {
            setLoading(false);
        }
    };


    /*
    |--------------------------------------------------------------------------
    | Open Register Modal
    |--------------------------------------------------------------------------
    */

    const openRegisterModal = () => {
        setShowRegisterModal(true);
        setDuplicateCandidates([]);
        setError("");
        setSuccess("");
    };


    /*
    |--------------------------------------------------------------------------
    | Handle Registration
    |--------------------------------------------------------------------------
    */

    const handleRegister = async (formData) => {
        try {
            setLoading(true);
            setError("");

            const result =await registerPatient(formData);

            setSuccess("Patient registered successfully! UHID: " + result.data.uhid);
            setShowRegisterModal(false);

            setSearchQuery("");
            setSearchResults([]);

            const patientResult = await getPatientById(result.data.id);
            setSelectedPatient(patientResult.data);

            setView("details");
        } catch (error) {
            console.error("Registration error:",error);

            if (error.response?.status === 409 && error.response?.data?.code === "PATIENT_DUPLICATE_PHONE") {
                setDuplicateCandidates(error.response.data.duplicates || []);
                setError("");
            } else {
                setError(error.response?.data?.message || "Failed to register patient");
            }
        } finally {
            setLoading(false);
        }
    };


    /*
    |--------------------------------------------------------------------------
    | View Duplicate Candidate
    |--------------------------------------------------------------------------
    */

    const viewDuplicateCandidate =
        async (patientId) => {
            try {
                setLoading(true);
                setError("");

                const result =
                    await getPatientById(
                        patientId
                    );

                setSelectedPatient(
                    result.data
                );

                setShowRegisterModal(
                    false
                );

                setView("details");
            } catch (error) {
                console.error(
                    "Failed to load patient details:",
                    error
                );

                setError(
                    "Failed to load patient details"
                );
            } finally {
                setLoading(false);
            }
        };


    /*
    |--------------------------------------------------------------------------
    | Go Back to Search
    |--------------------------------------------------------------------------
    */

    const goBackToSearch = () => {
        setView("search");
        setSelectedPatient(null);
        setError("");
        setSuccess("");

        if (!searchQuery.trim()) {
            loadTodayVisits(
                todayPagination.page,
                20
            );
        }
    };


    /*
    |--------------------------------------------------------------------------
    | Handle After Update
    |--------------------------------------------------------------------------
    */

    const handleAfterUpdate = (
        updatedPatient
    ) => {
        setSelectedPatient(
            updatedPatient
        );

        setSuccess(
            "Patient updated successfully"
        );

        setView("details");
    };


    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="patient-management">

            {/* ========================================================= */}
            {/* SEARCH TOOLBAR */}
            {/* ========================================================= */}

            {view === "search" && (
                <div className="patient-toolbar">

                    <form
                        className="patient-search-box"
                        onSubmit={handleSearch}
                        style={{
                            display: "flex",
                            gap: "10px",
                            flex: 1,
                            maxWidth: "100%",
                        }}
                    >

                        <div
                            style={{
                                display: "flex",
                                flexDirection:
                                    "column",
                                gap: "7px",
                                flex: 1,
                            }}
                        >

                            <label>
                                Search Patients
                            </label>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                }}
                            >

                                <input
                                    type="text"
                                    placeholder="Enter UHID, name, or phone..."
                                    value={
                                        searchQuery
                                    }
                                    onChange={(e) =>{
                                        setSearchQuery(e.target.value);
                                        setHasSearched(false);
                                        setSearchResults([]);
                                        setError("");
                                    }}
                                    style={{
                                        flex: 1,
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="search-btn"
                                    disabled={
                                        loading
                                    }
                                >
                                    <FaSearch />
                                    {" "}
                                    Search
                                </button>

                            </div>
                        </div>

                    </form>


                    <button
                        className="register-btn"
                        onClick={
                            openRegisterModal
                        }
                        disabled={loading}
                    >
                        <span>+</span>
                        {" "}
                        New Patient
                    </button>

                </div>
            )}


            {/* ========================================================= */}
            {/* CONTENT */}
            {/* ========================================================= */}

            <div className="patient-content">

                {error && (
                    <div className="patient-error">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="patient-success">
                        {success}
                    </div>
                )}

                                
                {/* ===================================================== */}
                {/* PATIENT LIST / SEARCH RESULTS */}
                {/* ===================================================== */}

                {view === "search" && (
                    <>
                        {loading ? (
                            <div className="patient-loading">
                                Loading...
                            </div>
                        ) : searchQuery.trim() && hasSearched ? (

                            /*
                            |--------------------------------------------------------------------------
                            | SEARCH RESULTS
                            |--------------------------------------------------------------------------
                            */

                            searchResults.length > 0 ? (

                                <div className="patient-results-container">

                                    <div className="patient-list-header">
                                        <div>
                                            <h3 className="patient-list-title">
                                                Search Results
                                            </h3>

                                            <p className="patient-list-subtitle">
                                                Patients matching your search
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="action-btn"
                                            onClick={handleClearSearch}
                                        >
                                            Clear Search
                                        </button>
                                    </div>

                                     <div className="patient-table-wrapper">
                                        <table className="patient-table">

                                            <thead>
                                                <tr>

                                                    <th>
                                                        UHID
                                                    </th>

                                                    <th>
                                                        Name
                                                    </th>

                                                    <th>
                                                        Age
                                                    </th>

                                                    <th>
                                                        Gender
                                                    </th>

                                                    <th>
                                                        Phone
                                                    </th>

                                                    <th>
                                                        Scheme
                                                    </th>

                                                    <th>
                                                        Status
                                                    </th>

                                                    <th>
                                                        Action
                                                    </th>

                                                </tr>
                                            </thead>


                                            <tbody>

                                                {searchResults.map(
                                                    (patient) => (
                                                        <tr
                                                            key={
                                                                patient.id
                                                            }
                                                        >

                                                            <td>
                                                                {
                                                                    patient.uhid
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient.firstName
                                                                }{" "}
                                                                {
                                                                    patient.middleName
                                                                }{" "}
                                                                {
                                                                    patient.lastName
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient.age
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient.gender
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient.phone
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient
                                                                        .scheme
                                                                        ?.name ||
                                                                    "No scheme"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    patient.status
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() =>
                                                                        viewPatientDetails(
                                                                            patient.id
                                                                        )
                                                                    }
                                                                >
                                                                    View
                                                                </button>
                                                            </td>

                                                        </tr>
                                                    )
                                                )}

                                            </tbody>

                                        </table>
                                    </div>

                                </div>

                            ) : (

                                <div className="patient-empty-state">
                                    <div className="patient-empty-title">
                                        No patients found
                                    </div>

                                    <p>
                                        No patient matches "{searchQuery}".
                                        Please check the spelling or try searching
                                        by UHID or phone number.
                                    </p>

                                    <button
                                        type="button"
                                        className="action-btn"
                                        onClick={handleClearSearch}
                                    >
                                        Back to Today's Patients
                                    </button>
                                </div>
                                

                            )

                        ) : (

                            /*
                            |--------------------------------------------------------------------------
                            | TODAY'S OP VISITS
                            |--------------------------------------------------------------------------
                            */

                            <div className="patient-results-container">

                                <div className="patient-list-header">
                                    <div>
                                        <h3 className="patient-list-title">
                                            TODAY'S OP VISITS
                                        </h3>

                                        <p className="patient-list-subtitle">
                                            Patients with OP tickets today
                                        </p>
                                    </div>
                                </div>


                                {todayVisits.length === 0 ? (

                                    <div className="patient-empty-state">
                                        <div className="patient-empty-title">
                                            No OP visits today.
                                        </div>

                                        <p>
                                            Today's OP visits will appear here.
                                        </p>
                                    </div>

                                ) : (

                                    <>
                                        <table className="patient-table">

                                            <thead>

                                                <tr>

                                                    <th>
                                                        Token
                                                    </th>

                                                    <th>
                                                        UHID
                                                    </th>

                                                    <th>
                                                        Patient Name
                                                    </th>

                                                    <th>
                                                        Age
                                                    </th>

                                                    <th>
                                                        Gender
                                                    </th>

                                                    <th>
                                                        Department
                                                    </th>

                                                    <th>
                                                        Doctor
                                                    </th>

                                                    <th>
                                                        Visit Type
                                                    </th>

                                                    <th>
                                                        Status
                                                    </th>

                                                    <th>
                                                        Action
                                                    </th>

                                                </tr>

                                            </thead>


                                            <tbody>

                                                {todayVisits.map(
                                                    (visit) => (
                                                        <tr
                                                            key={
                                                                visit.id
                                                            }
                                                        >

                                                            <td>
                                                                {
                                                                    visit.tokenNumber
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.patient?.uhid
                                                                }
                                                            </td>

                                                            <td>
                                                                {[
                                                                    visit.patient?.firstName,
                                                                    visit.patient?.middleName,
                                                                    visit.patient?.lastName,
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(" ")}
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.patient?.age
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.patient?.gender
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.department?.name ||
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.doctor?.fullName ||
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.visitType
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    visit.status
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() =>
                                                                        viewPatientDetails(
                                                                            visit.patient?.id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        !visit.patient?.id
                                                                    }
                                                                >
                                                                    View
                                                                </button>
                                                            </td>

                                                        </tr>
                                                    )
                                                )}

                                            </tbody>

                                        </table>


                                        {/* ================================================= */}
                                        {/* PAGINATION */}
                                        {/* ================================================= */}

                                        {todayPagination.totalPages >
                                            1 && (

                                            <div className="patient-pagination" >

                                                <button
                                                    className="action-btn"
                                                    disabled={
                                                        !todayPagination.hasPreviousPage
                                                    }
                                                    onClick={() =>
                                                        loadTodayVisits(
                                                            todayPagination.page -
                                                            1,
                                                            20
                                                        )
                                                    }
                                                >
                                                    Previous
                                                </button>


                                                <span className="patient-pagination-info">
                                                    Page{" "}
                                                    {
                                                        todayPagination.page
                                                    }{" "}
                                                    of{" "}
                                                    {
                                                        todayPagination.totalPages
                                                    }
                                                </span>


                                                <button
                                                    className="action-btn"
                                                    disabled={
                                                        !todayPagination.hasNextPage
                                                    }
                                                    onClick={() =>
                                                        loadTodayVisits(
                                                            todayPagination.page +
                                                            1,
                                                            20
                                                        )
                                                    }
                                                >
                                                    Next
                                                </button>

                                            </div>

                                        )}

                                    </>

                                )}

                            </div>

                        )}
                    </>
                )}


                {/* ===================================================== */}
                {/* DETAILS VIEW */}
                {/* ===================================================== */}

                {view === "details" &&
                    selectedPatient && (
                        <PatientDetails
                            patient={
                                selectedPatient
                            }
                            onBack={
                                goBackToSearch
                            }
                            onAfterUpdate={
                                handleAfterUpdate
                            }
                            schemes={
                                schemes
                            }
                        />
                    )}

            </div>


            {/* ========================================================= */}
            {/* REGISTER MODAL */}
            {/* ========================================================= */}

            {showRegisterModal && (
                <div className="modal-overlay">

                    <div className="modal-content">

                        <div className="modal-header">

                            <h2>
                                Register New Patient
                            </h2>

                            <button
                                className="modal-close-btn"
                                onClick={() => {
                                    setShowRegisterModal(
                                        false
                                    );

                                    setDuplicateCandidates(
                                        []
                                    );

                                    setError("");
                                }}
                            >
                                ×
                            </button>

                        </div>


                        <div className="modal-body">

                            {/* ================================================= */}
                            {/* DUPLICATE WARNING */}
                            {/* ================================================= */}

                            {duplicateCandidates.length >
                                0 && (

                                <div className="duplicate-warning">

                                    <h3>
                                        ⚠️ Possible Duplicate
                                        Phone Number
                                    </h3>

                                    <p>
                                        A patient with this
                                        phone number may
                                        already exist. Please
                                        check the following
                                        candidates:
                                    </p>


                                    <div className="duplicate-candidates">

                                        {duplicateCandidates.map(
                                            (candidate) => (

                                                <div
                                                    key={
                                                        candidate.id
                                                    }
                                                    className="duplicate-item"
                                                >

                                                    <div className="duplicate-item-info">

                                                        <div className="duplicate-item-details">

                                                            <div className="duplicate-item-name">
                                                                {
                                                                    candidate.firstName
                                                                }{" "}
                                                                {
                                                                    candidate.lastName
                                                                }
                                                            </div>

                                                            <div className="duplicate-item-meta">
                                                                UHID:{" "}
                                                                {
                                                                    candidate.uhid
                                                                }
                                                                {" | "}
                                                                Age:{" "}
                                                                {
                                                                    candidate.age
                                                                }
                                                                {" | "}
                                                                Phone:{" "}
                                                                {
                                                                    candidate.phone
                                                                }
                                                                {" | "}
                                                                Status:{" "}
                                                                {
                                                                    candidate.status
                                                                }
                                                            </div>

                                                        </div>


                                                        <button
                                                            className="duplicate-item-button"
                                                            onClick={() =>
                                                                viewDuplicateCandidate(
                                                                    candidate.id
                                                                )
                                                            }
                                                        >
                                                            View
                                                        </button>

                                                    </div>

                                                </div>
                                            )
                                        )}

                                    </div>


                                    <p
                                        style={{
                                            marginTop:
                                                "12px",
                                            fontStyle:
                                                "italic",
                                            fontSize:
                                                "12px",
                                        }}
                                    >
                                        If you are sure
                                        this is a new
                                        patient, you can
                                        continue with
                                        registration below.
                                    </p>

                                </div>
                            )}


                            {/* ================================================= */}
                            {/* REGISTRATION FORM */}
                            {/* ================================================= */}

                            <PatientRegisterForm
                                onRegister={
                                    handleRegister
                                }

                                onCancel={() => {
                                    setShowRegisterModal(
                                        false
                                    );

                                    setDuplicateCandidates(
                                        []
                                    );

                                    setError("");
                                }}

                                loading={
                                    loading
                                }

                                schemes={
                                    schemes
                                }

                                showDuplicates={
                                    duplicateCandidates.length >
                                    0
                                }
                            />

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

export default PatientManagement;
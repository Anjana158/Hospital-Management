import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import {
    searchPatients,
    getPatientById,
    registerPatient,
    updatePatient,
    getPatientSchemes,
} from "./services/patientService";

import {
    getTodayVisits,
    registerVisit,
} from "./services/visitService";

import { getDepartments } from "../admin/services/departmentService";

import "../styles/PatientManagement.css";
import PatientRegisterForm from "./PatientRegisterForm";
import PatientDetails from "./PatientDetails";

function toPatientPayload(formData, existingPatient) {
    const payload = {
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone?.trim() || "",
        alternatePhone: formData.alternatePhone,
        email: formData.email,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        city: formData.city,
        district: formData.district,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
        schemeId: formData.schemeId
            ? Number(formData.schemeId)
            : existingPatient
                ? ""
                : undefined,
        schemeAdditionalInformation: formData.schemeAdditionalInformation || [],
    };

    return payload;
}

function PatientManagement() {
    const navigate = useNavigate();
    const [view, setView] = useState("search");

    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState("all");
    const [searchResults, setSearchResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [genderFilter, setGenderFilter] = useState("ALL");
    const [ageFilter, setAgeFilter] = useState("ALL");
    const [searchPagination, setSearchPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [selectedPatient, setSelectedPatient] = useState(null);

    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [formPatient, setFormPatient] = useState(null);
    const [formSession, setFormSession] = useState("new-patient");
    const [departments, setDepartments] = useState([]);
    const [modalError, setModalError] = useState("");

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
        loadDepartments();
        loadTodayVisits();
    }, []);

    const loadDepartments = async () => {
        try {
            const result = await getDepartments();
            setDepartments(result.departments || []);
        } catch (error) {
            console.error("Failed to load departments:", error);
            setDepartments([]);
        }
    };

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

    const runPatientSearch = async (
        query,
        field,
        page = 1,
        gender = genderFilter,
        ageGroup = ageFilter
    ) => {
        if (!query.trim()) {
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
                query,
                field,
                page,
                20,
                gender,
                ageGroup
            );

            const results = result.data?.items || [];

            setSearchResults(results);
            setSearchPagination(result.data?.pagination || {
                page: 1,
                limit: 20,
                total: results.length,
                totalPages: results.length ? 1 : 0,
                hasNextPage: false,
                hasPreviousPage: false,
            });
            setHasSearched(true);

            if (results.length === 0) {
                setError("No patients found matching your search");
            }
        } catch (error) {
            console.error("Search error:", error);

            setSearchResults([]);
            setHasSearched(false);
            setSearchPagination({
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            });

            setError(
                error.response?.data?.message ||
                "Failed to search patients"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        runPatientSearch(searchQuery, searchField, 1);
    };

    const handleGenderFilterChange = (e) => {
        const gender = e.target.value;
        setGenderFilter(gender);
        if (hasSearched && searchQuery.trim()) {
            runPatientSearch(searchQuery, searchField, 1, gender, ageFilter);
        }
    };

    const handleAgeFilterChange = (e) => {
        const ageGroup = e.target.value;
        setAgeFilter(ageGroup);
        if (hasSearched && searchQuery.trim()) {
            runPatientSearch(searchQuery, searchField, 1, genderFilter, ageGroup);
        }
    };

    const handleSearchPageChange = (page) => {
        runPatientSearch(searchQuery, searchField, page);
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setSearchResults([]);
        setHasSearched(false);
        setGenderFilter("ALL");
        setAgeFilter("ALL");
        setSearchPagination({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
        });
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
        setFormPatient(null);
        setFormSession(`new-${Date.now()}`);
        setShowRegisterModal(true);
        setDuplicateCandidates([]);
        setModalError("");
        setError("");
        setSuccess("");
    };

    const openOpRegister = async (patientId) => {
        try {
            setLoading(true);
            setError("");
            setSuccess("");
            setModalError("");
            setDuplicateCandidates([]);

            const result = await getPatientById(patientId);
            setFormPatient(result.data);
            setFormSession(`patient-${result.data.id}`);
            setShowRegisterModal(true);
        } catch (error) {
            console.error("Failed to open OP register:", error);
            setError(
                error.response?.data?.message ||
                "Failed to load patient details"
            );
        } finally {
            setLoading(false);
        }
    };

    const savePatientFromForm = async (formData) => {
        const payload = toPatientPayload(formData, formPatient);

        if (formPatient?.id) {
            const result = await updatePatient(formPatient.id, payload);
            setFormPatient(result.data);
            return result.data;
        }

        const result = await registerPatient(payload);
        setFormPatient(result.data);
        return result.data;
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
            setModalError("");

            const savedPatient = await savePatientFromForm(formData);

            setSuccess(
                formPatient?.id
                    ? "Patient updated successfully"
                    : "Patient registered successfully! UHID: " + savedPatient.uhid
            );
            setShowRegisterModal(false);
            setFormPatient(null);

            setSearchQuery("");
            setSearchResults([]);

            const patientResult = await getPatientById(savedPatient.id);
            setSelectedPatient(patientResult.data);

            setView("details");
        } catch (error) {
            console.error("Registration error:",error);

            if (error.response?.status === 409 && error.response?.data?.code === "PATIENT_DUPLICATE_PHONE") {
                setDuplicateCandidates(error.response.data.duplicates || []);
                setModalError("");
            } else {
                setModalError(error.response?.data?.message || "Failed to register patient");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpTicket = async (formData) => {
        try {
            setLoading(true);
            setError("");
            setModalError("");

            const savedPatient = await savePatientFromForm(formData);

            const visitResult = await registerVisit({
                patientId: savedPatient.id,
                departmentId: Number(formData.departmentId),
                schemeId: formData.schemeId,
                opFee: Number(formData.opFee),
                paymentMethod: formData.paymentMethod,
                schemeAdditionalInformation: (formData.schemeAdditionalInformation || [])
                    .map(({ key, value }) => ({ key, value })),
            });

            setShowRegisterModal(false);
            setFormPatient(null);
            setDuplicateCandidates([]);

            navigate(
                `/reception/op-ticket/${visitResult.data.visit.id}`,
                {
                    state: {
                        visit: visitResult.data.visit,
                        tokenNumber: visitResult.data.tokenNumber,
                        tokenLabel: visitResult.data.tokenLabel,
                        autoPrint: true,
                    },
                }
            );
        } catch (error) {
            console.error("OP ticket error:", error);

            if (error.response?.status === 409 && error.response?.data?.code === "PATIENT_DUPLICATE_PHONE") {
                setDuplicateCandidates(error.response.data.duplicates || []);
                setModalError("");
            } else {
                setModalError(
                    error.response?.data?.message ||
                    "Failed to create the OP ticket"
                );
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
                    >
                        <input
                            type="text"
                            aria-label="Search patients"
                            placeholder="Enter UHID, name, or phone..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setHasSearched(false);
                                setSearchResults([]);
                                setSearchPagination({
                                    page: 1,
                                    limit: 20,
                                    total: 0,
                                    totalPages: 0,
                                    hasNextPage: false,
                                    hasPreviousPage: false,
                                });
                                setError("");
                            }}
                        />
                        <button
                            type="submit"
                            className="search-btn"
                            disabled={loading}
                        >
                            <FaSearch />
                            {" "}
                            Search
                        </button>
                    </form>

                    <select
                        className="patient-filter-select"
                        aria-label="Filter by gender"
                        value={genderFilter}
                        onChange={handleGenderFilterChange}
                    >
                        <option value="ALL">All</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="TRANSGENDER">Transgender</option>
                    </select>

                    <select
                        className="patient-filter-select"
                        aria-label="Filter by age"
                        value={ageFilter}
                        onChange={handleAgeFilterChange}
                    >
                        <option value="ALL">All</option>
                        <option value="0-13">0-13</option>
                        <option value="13-18">13-18</option>
                        <option value="above-18">Above 18</option>
                    </select>

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
                                                                {" "}
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() =>
                                                                        openOpRegister(
                                                                            patient.id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        patient.status !== "ACTIVE"
                                                                    }
                                                                >
                                                                    OP Register
                                                                </button>
                                                            </td>

                                                        </tr>
                                                    )
                                                )}

                                            </tbody>

                                        </table>
                                    </div>

                                    {searchPagination.totalPages > 1 && (
                                        <div className="patient-pagination">
                                            <button
                                                className="action-btn"
                                                disabled={!searchPagination.hasPreviousPage}
                                                onClick={() => handleSearchPageChange(searchPagination.page - 1)}
                                            >
                                                Previous
                                            </button>
                                            <span className="patient-pagination-info">
                                                Page {searchPagination.page} of {searchPagination.totalPages}
                                            </span>
                                            <button
                                                className="action-btn"
                                                disabled={!searchPagination.hasNextPage}
                                                onClick={() => handleSearchPageChange(searchPagination.page + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}

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
                                                                    visit.tokenLabel ||
                                                                    (visit.tokenNumber
                                                                        ? `HMS ${visit.tokenNumber}`
                                                                        : "—")
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
                                                                <button
                                                                    className="action-btn secondary"
                                                                    onClick={() =>
                                                                        navigate(
                                                                            `/reception/op-ticket/${visit.id}`,
                                                                            { state: { autoPrint: true } }
                                                                        )
                                                                    }
                                                                >
                                                                    Reprint OP Ticket
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
                            onRegisterOp={() =>
                                openOpRegister(
                                    selectedPatient.id
                                )
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
                                {formPatient
                                    ? "OP Register"
                                    : "Register New Patient"}
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
                                key={formSession}
                                onRegister={
                                    handleRegister
                                }
                                onOpTicket={
                                    handleOpTicket
                                }

                                onCancel={() => {
                                    setShowRegisterModal(
                                        false
                                    );
                                    setFormPatient(null);

                                    setDuplicateCandidates(
                                        []
                                    );
                                    setModalError("");

                                    setError("");
                                }}

                                loading={
                                    loading
                                }

                                schemes={
                                    schemes
                                }
                                departments={
                                    departments
                                }
                                initialPatient={
                                    formPatient
                                }
                                serverError={
                                    modalError
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
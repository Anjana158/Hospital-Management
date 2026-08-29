import { useEffect, useState } from "react";
import { FaSearch, FaUserPlus } from "react-icons/fa";

import {
    searchPatients,
    getPatientById,
    registerPatient,
    getPatientCategories,
} from "./services/patientService";

import "./PatientManagement.css";
import PatientRegisterForm from "./PatientRegisterForm";
import PatientDetails from "./PatientDetails";

function PatientManagement() {
    const [view, setView] = useState("search"); // search, register, details, duplicates
    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState("all");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [duplicateCandidates, setDuplicateCandidates] = useState([]);
    const [categories, setCategories] = useState([]);

    // ====================================
    // LOAD CATEGORIES
    // ====================================

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const result = await getPatientCategories();
            setCategories(result.data || []);
        } catch (error) {
            console.error("Failed to load categories:", error);
        }
    };

    // ====================================
    // SEARCH PATIENTS
    // ====================================

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!searchQuery.trim()) {
            setError("Please enter a search query");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSuccess("");

            const result = await searchPatients(
                searchQuery,
                searchField,
                1,
                20
            );

            setSearchResults(result.data?.items || []);

            if (result.data?.items?.length === 0) {
                setError("No patients found matching your search");
            }
        } catch (error) {
            console.error("Search error:", error);
            setError(
                error.response?.data?.message ||
                "Failed to search patients"
            );
        } finally {
            setLoading(false);
        }
    };

    // ====================================
    // VIEW PATIENT DETAILS
    // ====================================

    const viewPatientDetails = async (patientId) => {
        try {
            setLoading(true);
            const result = await getPatientById(patientId);
            setSelectedPatient(result.data);
            setView("details");
        } catch (error) {
            console.error("Failed to load patient details:", error);
            setError("Failed to load patient details");
        } finally {
            setLoading(false);
        }
    };

    // ====================================
    // OPEN REGISTER MODAL
    // ====================================

    const openRegisterModal = () => {
        setShowRegisterModal(true);
        setDuplicateCandidates([]);
        setError("");
        setSuccess("");
    };

    // ====================================
    // HANDLE REGISTRATION
    // ====================================

    const handleRegister = async (formData) => {
        try {
            setLoading(true);
            setError("");

            const result = await registerPatient(formData);

            setSuccess(
                "Patient registered successfully! UHID: " +
                result.data.uhid
            );
            setShowRegisterModal(false);
            setSearchQuery("");
            setSearchResults([]);

            // Auto-load the new patient details
            setSelectedPatient(result.data);
            setView("details");
        } catch (error) {
            console.error("Registration error:", error);

            if (
                error.response?.status === 409 &&
                error.response?.data?.code ===
                "PATIENT_DUPLICATE_PHONE"
            ) {
                // Show duplicate warning
                setDuplicateCandidates(
                    error.response.data.duplicates || []
                );
                setError("");
            } else {
                setError(
                    error.response?.data?.message ||
                    "Failed to register patient"
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // ====================================
    // VIEW FROM DUPLICATE CANDIDATES
    // ====================================

    const viewDuplicateCandidate = async (patientId) => {
        try {
            setLoading(true);
            const result = await getPatientById(patientId);
            setSelectedPatient(result.data);
            setShowRegisterModal(false);
            setView("details");
        } catch (error) {
            console.error("Failed to load patient details:", error);
            setError("Failed to load patient details");
        } finally {
            setLoading(false);
        }
    };

    // ====================================
    // GO BACK TO SEARCH
    // ====================================

    const goBackToSearch = () => {
        setView("search");
        setSelectedPatient(null);
    };

    // ====================================
    // HANDLE AFTER UPDATE
    // ====================================

    const handleAfterUpdate = (updatedPatient) => {
        setSelectedPatient(updatedPatient);
        setSuccess("Patient updated successfully");
        setView("details");
    };

    return (
        <div className="patient-management">
            {/* TOOLBAR */}
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
                                flexDirection: "column",
                                gap: "7px",
                                flex: 1,
                            }}
                        >
                            <label>Search Patients</label>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                }}
                            >
                                <input
                                    type="text"
                                    placeholder="Enter UHID, name, or phone..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(
                                            e.target.value
                                        )
                                    }
                                    style={{ flex: 1 }}
                                />
                                <select
                                    value={searchField}
                                    onChange={(e) =>
                                        setSearchField(
                                            e.target.value
                                        )
                                    }
                                    style={{
                                        width: "140px",
                                    }}
                                >
                                    <option value="all">
                                        All Fields
                                    </option>
                                    <option value="uhid">
                                        UHID
                                    </option>
                                    <option value="name">
                                        Name
                                    </option>
                                    <option value="phone">
                                        Phone
                                    </option>
                                </select>
                                <button
                                    type="submit"
                                    className="search-btn"
                                    disabled={loading}
                                >
                                    <FaSearch /> Search
                                </button>
                            </div>
                        </div>
                    </form>

                    <button
                        className="register-btn"
                        onClick={openRegisterModal}
                    >
                        <span>+</span> New Patient
                    </button>
                </div>
            )}

            {/* CONTENT AREA */}
            <div className="patient-content">
                {/* ERROR MESSAGE */}
                {error && (
                    <div className="patient-error">
                        {error}
                    </div>
                )}

                {/* SUCCESS MESSAGE */}
                {success && (
                    <div className="patient-success">
                        {success}
                    </div>
                )}

                {/* SEARCH VIEW */}
                {view === "search" && (
                    <>
                        {loading ? (
                            <div className="patient-loading">
                                Loading...
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="patient-results-container">
                                <table className="patient-table">
                                    <thead>
                                        <tr>
                                            <th>UHID</th>
                                            <th>Name</th>
                                            <th>Phone</th>
                                            <th>Gender</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Action</th>
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
                                                            patient.lastName
                                                        }
                                                    </td>
                                                    <td>
                                                        {
                                                            patient.phone
                                                        }
                                                    </td>
                                                    <td>
                                                        {
                                                            patient.gender
                                                        }
                                                    </td>
                                                    <td>
                                                        {
                                                            patient
                                                                .category
                                                                ?.name
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
                        ) : searchQuery === "" ? null : (
                            <div style={{
                                textAlign: "center",
                                padding: "40px",
                                color: "#667999",
                            }}>
                                No patients found
                            </div>
                        )}
                    </>
                )}

                {/* DETAILS VIEW */}
                {view === "details" && selectedPatient && (
                    <PatientDetails
                        patient={selectedPatient}
                        onBack={goBackToSearch}
                        onAfterUpdate={handleAfterUpdate}
                        categories={categories}
                    />
                )}
            </div>

            {/* REGISTER MODAL */}
            {showRegisterModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Register New Patient</h2>
                            <button
                                className="modal-close-btn"
                                onClick={() => {
                                    setShowRegisterModal(
                                        false
                                    );
                                    setDuplicateCandidates([]);
                                    setError("");
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* DUPLICATE WARNING */}
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
                                            marginTop: "12px",
                                            fontStyle: "italic",
                                            fontSize: "12px",
                                        }}
                                    >
                                        If you are sure this is
                                        a new patient, you can
                                        continue with
                                        registration below.
                                    </p>
                                </div>
                            )}

                            {/* REGISTRATION FORM */}
                            <PatientRegisterForm
                                onRegister={handleRegister}
                                onCancel={() => {
                                    setShowRegisterModal(
                                        false
                                    );
                                    setDuplicateCandidates([]);
                                    setError("");
                                }}
                                loading={loading}
                                categories={categories}
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

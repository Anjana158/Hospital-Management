import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { getDepartments } from "../admin/services/departmentService";
import { getRegisteredPatients } from "./services/patientService";
import "./RegisteredPatients.css";

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
};

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
}

function patientName(patient) {
    return patient.firstName || "";
}

function formatGender(value) {
    return {
        MALE: "Male",
        FEMALE: "Female",
        TRANSGENDER: "Transgender",
    }[value] || "—";
}

function RegisteredPatients() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({
        q: "",
        departmentId: "",
        age: "",
        gender: "ALL",
        fromDate: "",
        toDate: "",
    });
    const [page, setPage] = useState(1);
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [departmentError, setDepartmentError] = useState("");
    const [error, setError] = useState("");
    const [dateError, setDateError] = useState("");

    useEffect(() => {
        let active = true;

        getDepartments()
            .then((result) => {
                if (active) {
                    setDepartments(result.departments || []);
                }
            })
            .catch((loadError) => {
                if (active) {
                    setDepartmentError(
                        loadError.response?.data?.message ||
                        "Failed to load departments"
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (
            filters.fromDate &&
            filters.toDate &&
            filters.fromDate > filters.toDate
        ) {
            setDateError("From Date cannot be later than To Date.");
            setLoading(false);
            return undefined;
        }

        setDateError("");
        setLoading(true);
        setError("");

        let active = true;
        const timer = setTimeout(() => {
            const params = {
                ...filters,
                page,
                limit: EMPTY_PAGINATION.limit,
            };

            if (!params.departmentId) {
                delete params.departmentId;
            }
            if (params.age === "") {
                delete params.age;
            }
            if (params.gender === "ALL") {
                delete params.gender;
            }
            if (!params.fromDate) {
                delete params.fromDate;
            }
            if (!params.toDate) {
                delete params.toDate;
            }

            getRegisteredPatients(params)
                .then((result) => {
                    if (active) {
                        setItems(result.data?.items || []);
                        setPagination(result.data?.pagination || EMPTY_PAGINATION);
                    }
                })
                .catch((loadError) => {
                    if (active) {
                        setItems([]);
                        setPagination(EMPTY_PAGINATION);
                        setError(
                            loadError.response?.data?.message ||
                            "Failed to load registered patients"
                        );
                    }
                })
                .finally(() => {
                    if (active) {
                        setLoading(false);
                    }
                });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [filters, page]);

    const updateFilter = (name, value) => {
        setFilters((current) => ({ ...current, [name]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({
            q: "",
            departmentId: "",
            age: "",
            gender: "ALL",
            fromDate: "",
            toDate: "",
        });
        setPage(1);
    };

    const hasFilters = Object.entries(filters).some(([key, value]) => (
        key === "gender" ? value !== "ALL" : Boolean(value)
    ));

    return (
        <section className="registered-patients-page reception-page">
            <header className="registered-patients-heading reception-page-header">
                <h1>Registered Patients</h1>
            </header>

            {departmentError && (
                <div className="registered-patients-error">{departmentError}</div>
            )}

            <div className="registered-patients-toolbar">
                <label className="registered-patients-search">
                    <FaSearch aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Search patients by name or phone"
                        placeholder="Search by patient name or phone..."
                        value={filters.q}
                        onChange={(event) => updateFilter("q", event.target.value)}
                    />
                </label>

                <div className="registered-patients-filter-row">
                    <label className="registered-patients-filter">
                        <span>Department</span>
                        <select
                            aria-label="Filter by department"
                            value={filters.departmentId}
                            onChange={(event) => updateFilter("departmentId", event.target.value)}
                        >
                            <option value="">All Departments</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="registered-patients-filter">
                        <span>Age</span>
                        <input
                            type="number"
                            aria-label="Filter by age"
                            placeholder="Any age"
                            min="0"
                            max="150"
                            step="1"
                            value={filters.age}
                            onChange={(event) => updateFilter("age", event.target.value)}
                        />
                    </label>

                    <label className="registered-patients-filter">
                        <span>Gender</span>
                        <select
                            aria-label="Filter by gender"
                            value={filters.gender}
                            onChange={(event) => updateFilter("gender", event.target.value)}
                        >
                            <option value="ALL">All Genders</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="TRANSGENDER">Transgender</option>
                        </select>
                    </label>

                    <label className="registered-patients-filter">
                        <span>From Date</span>
                        <input
                            type="date"
                            aria-label="From Date"
                            max={filters.toDate || undefined}
                            value={filters.fromDate}
                            onChange={(event) => updateFilter("fromDate", event.target.value)}
                        />
                    </label>

                    <label className="registered-patients-filter">
                        <span>To Date</span>
                        <input
                            type="date"
                            aria-label="To Date"
                            min={filters.fromDate || undefined}
                            value={filters.toDate}
                            onChange={(event) => updateFilter("toDate", event.target.value)}
                        />
                    </label>

                    <button
                        type="button"
                        className="registered-patients-reset"
                        onClick={clearFilters}
                        disabled={!hasFilters}
                    >
                        Reset
                    </button>
                </div>
            </div>

            {dateError && (
                <div className="registered-patients-error" role="alert">
                    {dateError}
                </div>
            )}
            {error && (
                <div className="registered-patients-error" role="alert">
                    {error}
                </div>
            )}

            <div className="registered-patients-table-container">
                {loading ? (
                    <div className="registered-patients-state">Loading registered patients...</div>
                ) : dateError ? (
                    <div className="registered-patients-state">Correct the date range to view results.</div>
                ) : error ? (
                    <div className="registered-patients-state">Unable to load records.</div>
                ) : items.length === 0 ? (
                    <div className="registered-patients-state">No registered patients found.</div>
                ) : (
                    <div className="registered-patients-table-scroll">
                        <table className="registered-patients-table">
                            <thead>
                                <tr>
                                    <th>Patient Name</th>
                                    <th>Gender</th>
                                    <th>Age</th>
                                    <th>Phone Number</th>
                                    <th>Department / Visit</th>
                                    <th>Registration Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((patient) => {
                                    const visit = patient.latestVisit;
                                    return (
                                        <tr key={patient.id}>
                                            <td>
                                                <strong>{patientName(patient) || "—"}</strong>
                                                <small>{patient.uhid}</small>
                                            </td>
                                            <td>{formatGender(patient.gender)}</td>
                                            <td>{patient.age ?? "—"}</td>
                                            <td>{patient.phone || "—"}</td>
                                            <td>
                                                {visit ? (
                                                    <span>
                                                        {visit.department?.name || "—"}
                                                        <small>
                                                            {formatDate(visit.visitDate)}
                                                            {visit.tokenLabel
                                                                ? ` · ${visit.tokenLabel}`
                                                                : visit.tokenNumber
                                                                    ? ` · HMS ${visit.tokenNumber}`
                                                                    : ""}
                                                        </small>
                                                    </span>
                                                ) : "No OP visit"}
                                            </td>
                                            <td>{formatDate(patient.createdAt)}</td>
                                            <td className="registered-patients-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(
                                                        `/reception/registered-patients/details/${patient.id}`,
                                                        { state: { from: "/reception/registered-patients" } }
                                                    )}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    type="button"
                                                    className="secondary"
                                                    disabled={!visit}
                                                    onClick={() => navigate(
                                                        `/reception/op-ticket/${visit.id}`,
                                                        {
                                                            state: {
                                                                autoPrint: true,
                                                                returnTo: "/reception/registered-patients",
                                                            },
                                                        }
                                                    )}
                                                >
                                                    Reprint OP Ticket
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {pagination.totalPages > 1 && !loading && !error && !dateError && (
                <nav className="registered-patients-pagination" aria-label="Patient list pages">
                    <button
                        type="button"
                        disabled={!pagination.hasPreviousPage}
                        onClick={() => setPage((current) => current - 1)}
                    >
                        Previous
                    </button>
                    <span>
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={!pagination.hasNextPage}
                        onClick={() => setPage((current) => current + 1)}
                    >
                        Next
                    </button>
                </nav>
            )}
        </section>
    );
}

export default RegisteredPatients;

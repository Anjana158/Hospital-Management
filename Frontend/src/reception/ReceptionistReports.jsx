import { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaChartBar, FaPrint, FaRedo, FaFilter } from "react-icons/fa";
import { getDepartments } from "../admin/services/departmentService";
import { getReceptionistReport } from "./services/reportService";
import "../styles/ReceptionistReports.css";

const REPORT_TYPES = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "custom", label: "Date Range" },
];

const AGE_GROUP_OPTIONS = [
    { value: "all", label: "All" },
    { value: "0-13", label: "0 to 13 years" },
    { value: "13-18", label: "13 to 18 years" },
    { value: "18+", label: "More than 18 years" },
];

const VISIT_TYPE_OPTIONS = [
    { value: "all", label: "All" },
    { value: "NEW", label: "New Visit" },
    { value: "REVISIT", label: "Revisit" },
];

const GENDER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "TRANSGENDER", label: "Transgender" },
];

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const formatAmount = (value) => {
    const amount = Number(value);
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeAmount);
};

function ReceptionistReports() {
    const [departments, setDepartments] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [filters, setFilters] = useState({
        period: "daily",
        date: getTodayIsoDate(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        fromDate: getTodayIsoDate(),
        toDate: getTodayIsoDate(),
        gender: "all",
        departmentId: "all",
        ageGroup: "all",
        visitType: "all",
    });

    useEffect(() => {
        const loadDepartments = async () => {
            try {
                const response = await getDepartments();
                const items = response?.departments || [];
                setDepartments(items);
            } catch (loadError) {
                console.error("Load departments error:", loadError);
            }
        };

        loadDepartments();
    }, []);

    const summaryCards = useMemo(() => {
        if (!report || !report.summary) {
            return [];
        }

        return [
            { label: "Total New Visits", value: report.summary.newVisits || 0 },
            { label: "Total Re-Visits", value: report.summary.reVisits || 0 },
            { label: "Total Visits", value: report.summary.totalVisits || 0 },
            { label: "Total OP Amount", value: formatAmount(report.summary.totalOpAmount) },
            { label: "Cash Collected", value: formatAmount(report.summary.cashCollected) },
            { label: "G-Pay Collected", value: formatAmount(report.summary.gpayCollected) },
            { label: "Free OP Visits", value: report.summary.freeOpVisits || 0 },
            { label: "Male", value: report.summary.male || 0 },
            { label: "Female", value: report.summary.female || 0 },
            { label: "Transgender", value: report.summary.transgender || 0 },
        ];
    }, [report]);

    const handleFieldChange = (event) => {
        const { name, value } = event.target;
        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const buildRequestParams = () => {
        const params = {
            period: filters.period,
        };

        if (filters.period === "daily") {
            params.date = filters.date || getTodayIsoDate();
        }

        if (filters.period === "weekly") {
            params.date = filters.date || getTodayIsoDate();
        }

        if (filters.period === "monthly") {
            params.month = filters.month;
            params.year = filters.year;
        }

        if (filters.period === "custom") {
            params.fromDate = filters.fromDate;
            params.toDate = filters.toDate;
        }

        if (filters.gender && filters.gender !== "all") {
            params.gender = filters.gender;
        }

        if (filters.departmentId && filters.departmentId !== "all") {
            params.departmentId = filters.departmentId;
        }

        if (filters.ageGroup && filters.ageGroup !== "all") {
            params.ageGroup = filters.ageGroup;
        }

        if (filters.visitType && filters.visitType !== "all") {
            params.visitType = filters.visitType;
        }

        return params;
    };

    useEffect(() => {
        let isCurrentRequest = true;

        const refreshReport = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await getReceptionistReport(buildRequestParams());
                if (isCurrentRequest) {
                    setReport(response.data || null);
                }
            } catch (generateError) {
                if (isCurrentRequest) {
                    setReport(null);
                    setError(generateError?.response?.data?.message || "Unable to generate the report.");
                }
            } finally {
                if (isCurrentRequest) {
                    setLoading(false);
                }
            }
        };

        refreshReport();

        return () => {
            isCurrentRequest = false;
        };
    }, [filters]);

    const handleResetFilters = () => {
        setFilters({
            period: "daily",
            date: getTodayIsoDate(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            fromDate: getTodayIsoDate(),
            toDate: getTodayIsoDate(),
            gender: "all",
            departmentId: "all",
            ageGroup: "all",
            visitType: "all",
        });
        setError("");
        setReport(null);
    };

    const renderDateControls = () => {
        if (filters.period === "daily") {
            return (
                <div className="report-form-group report-form-wide">
                    <label htmlFor="date">Date</label>
                    <input
                        id="date"
                        type="date"
                        name="date"
                        value={filters.date}
                        onChange={handleFieldChange}
                    />
                </div>
            );
        }

        if (filters.period === "weekly") {
            return (
                <div className="report-form-group report-form-wide">
                    <label htmlFor="date">Select Week</label>
                    <input
                        id="date"
                        type="date"
                        name="date"
                        value={filters.date}
                        onChange={handleFieldChange}
                    />
                </div>
            );
        }

        if (filters.period === "monthly") {
            return (
                <>
                    <div className="report-form-group">
                        <label htmlFor="month">Month</label>
                        <select id="month" name="month" value={filters.month} onChange={handleFieldChange}>
                            {Array.from({ length: 12 }, (_, index) => (
                                <option key={index + 1} value={index + 1}>
                                    {new Date(2024, index, 1).toLocaleString("en-US", { month: "long" })}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="report-form-group">
                        <label htmlFor="year">Year</label>
                        <select id="year" name="year" value={filters.year} onChange={handleFieldChange}>
                            {Array.from({ length: 8 }, (_, index) => {
                                const yearValue = new Date().getFullYear() - 3 + index;
                                return (
                                    <option key={yearValue} value={yearValue}>
                                        {yearValue}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </>
            );
        }

        return (
            <>
                <div className="report-form-group">
                    <label htmlFor="fromDate">From Date</label>
                    <input
                        id="fromDate"
                        type="date"
                        name="fromDate"
                        value={filters.fromDate}
                        onChange={handleFieldChange}
                    />
                </div>

                <div className="report-form-group">
                    <label htmlFor="toDate">To Date</label>
                    <input
                        id="toDate"
                        type="date"
                        name="toDate"
                        value={filters.toDate}
                        onChange={handleFieldChange}
                    />
                </div>
            </>
        );
    };

    return (
        <div className="reception-reports-page report-print-shell">
            <div className="report-page-header">
                <div className="report-page-title">
                    <div className="report-title-icon">
                        <FaChartBar />
                    </div>
                    <div>
                        <p>RECEPTION REPORTS</p>
                        <h2>Receptionist Reports</h2>
                    </div>
                </div>
            </div>

            <div className="report-controls-card">
                <div className="report-card-header">
                    <div>
                        <h3>Report filters</h3>
                        <p>Generate r eport data for your department activity.</p>
                    </div>
                    <FaFilter className="report-card-icon" />
                </div>

                <div className="report-form-grid">
                    <div className="report-form-group">
                        <label htmlFor="period">Report Period</label>
                        <select id="period" name="period" value={filters.period} onChange={handleFieldChange}>
                            {REPORT_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {renderDateControls()}

                    <div className="report-form-group">
                        <label htmlFor="gender">Gender</label>
                        <select id="gender" name="gender" value={filters.gender} onChange={handleFieldChange}>
                            {GENDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="report-form-group">
                        <label htmlFor="departmentId">Department</label>
                        <select id="departmentId" name="departmentId" value={filters.departmentId} onChange={handleFieldChange}>
                            <option value="all">All Departments</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="report-form-group">
                        <label htmlFor="ageGroup">Age Group</label>
                        <select id="ageGroup" name="ageGroup" value={filters.ageGroup} onChange={handleFieldChange}>
                            {AGE_GROUP_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="report-form-group">
                        <label htmlFor="visitType">Visit Type</label>
                        <select id="visitType" name="visitType" value={filters.visitType} onChange={handleFieldChange}>
                            {VISIT_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="report-action-row">
                    {loading && <span className="report-loading-status">Refreshing report...</span>}
                    <button className="report-secondary-btn" onClick={() => window.print()}>
                        <FaPrint />
                        Print Report
                    </button>
                    <button className="report-tertiary-btn" onClick={handleResetFilters}>
                        <FaRedo />
                        Reset Filters
                    </button>
                </div>

                {error && <div className="report-error">{error}</div>}
            </div>

            {report && (
                <div className="report-output-card">
                    <div className="report-print-header">
                        <div className="report-hospital-name">GENERAL HOSPITAL THRISSUR</div>
                        <div className="report-print-title">OPD Statistics report summary</div>
                        <div className="report-print-meta">
                            <div>
                                <strong>Period:</strong> {report.period?.label || "N/A"}
                            </div>
                            <div>
                                <strong>Date:</strong> {report.period?.rangeLabel || "N/A"}
                            </div>
                            <div>
                                <strong>Gender:</strong> {GENDER_OPTIONS.find((option) => option.value === report.filters?.gender)?.label || report.filters?.gender || "All"}
                            </div>
                            <div>
                                <strong>Department:</strong> {report.filters?.departmentName || "All Departments"}
                            </div>
                            <div>
                                <strong>Age Group:</strong> {AGE_GROUP_OPTIONS.find((option) => option.value === report.filters?.ageGroup)?.label || report.filters?.ageGroup || "All"}
                            </div>
                            <div>
                                <strong>Visit Type:</strong> {VISIT_TYPE_OPTIONS.find((option) => option.value === report.filters?.visitType)?.label || report.filters?.visitType || "All"}
                            </div>
                        </div>
                    </div>

                    <div className="report-summary-grid">
                        <div className="report-summary-card">
                            <span>Total Amount</span>
                            <strong>{formatAmount(report.summary?.totalAmount)}</strong>
                        </div>
                        {report.hasRecords && summaryCards.map((card) => (
                            <div key={card.label} className="report-summary-card">
                                <span>{card.label}</span>
                                <strong>{card.value}</strong>
                            </div>
                        ))}
                    </div>

                    {!report.hasRecords ? (
                        <div className="report-empty-state">No records found for the selected filters.</div>
                    ) : (
                        <>

                            <div className="report-table-wrapper">
                                <table className="report-data-table">
                                    <thead>
                                        <tr>
                                            <th rowSpan="3">Department</th>
                                            <th rowSpan="3">New Visits</th>
                                            <th rowSpan="3">Re-Visits</th>
                                            <th colSpan="4">Total Visits</th>
                                            <th colSpan="3">Age Distribution</th>
                                        </tr>
                                        <tr>
                                            <th>Male</th>
                                            <th>Female</th>
                                            <th>Transgender</th>
                                            <th>Total</th>
                                            <th>0-13</th>
                                            <th>13-18</th>
                                            <th>{">18"}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.departments?.map((row) => (
                                            <tr key={row.departmentId}>
                                                <td>{row.departmentName}</td>
                                                <td>{row.newVisits}</td>
                                                <td>{row.reVisits}</td>
                                                <td>{row.male}</td>
                                                <td>{row.female}</td>
                                                <td>{row.transgender}</td>
                                                <td>{row.totalVisits}</td>
                                                <td>{row.age0To13}</td>
                                                <td>{row.age13To18}</td>
                                                <td>{row.ageAbove18}</td>
                                            </tr>
                                        ))}
                                        <tr className="report-total-row">
                                            <td>Total</td>
                                            <td>{report.summary?.newVisits || 0}</td>
                                            <td>{report.summary?.reVisits || 0}</td>
                                            <td>{report.summary?.male || 0}</td>
                                            <td>{report.summary?.female || 0}</td>
                                            <td>{report.summary?.transgender || 0}</td>
                                            <td>{report.summary?.totalVisits || 0}</td>
                                            <td>{report.summary?.age0To13 || 0}</td>
                                            <td>{report.summary?.age13To18 || 0}</td>
                                            <td>{report.summary?.ageAbove18 || 0}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <div className="report-print-total">
                        <strong>Total Amount collected:</strong> {formatAmount(report.summary?.totalAmount)}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceptionistReports;

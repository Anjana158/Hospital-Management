import { useEffect, useState } from "react";
import { FaFilter, FaPrint, FaRedo } from "react-icons/fa";
import { getDepartments } from "./services/departmentService";
import { getAdminReceptionReport } from "./services/reportService";
import "../styles/ReceptionistReports.css";

const REPORT_TYPES = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "custom", label: "Date Range" },
];

const today = () => new Date().toISOString().split("T")[0];
const initialFilters = () => ({
    period: "daily",
    date: today(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    fromDate: today(),
    toDate: today(),
    receptionistId: "all",
    gender: "all",
    departmentId: "all",
    ageGroup: "all",
    visitType: "all",
});

function buildRequestParams(filters) {
    const params = { period: filters.period };

    if (filters.period === "daily" || filters.period === "weekly") {
        params.date = filters.date || today();
    } else if (filters.period === "monthly") {
        params.month = filters.month;
        params.year = filters.year;
    } else {
        params.fromDate = filters.fromDate;
        params.toDate = filters.toDate;
    }

    ["receptionistId", "gender", "departmentId", "ageGroup", "visitType"].forEach((key) => {
        if (filters[key] && filters[key] !== "all") params[key] = filters[key];
    });

    return params;
}

function formatAmount(value) {
    const amount = Number(value);
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
}

function BreakdownTable({ title, headers, rows, emptyMessage = "No records" }) {
    return (
        <section className="admin-report-section">
            <h3>{title}</h3>
            <div className="report-table-wrapper">
                <table className="report-data-table">
                    <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                    <tbody>
                        {rows.length ? rows.map((row, index) => (
                            <tr key={row.key ?? index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                        )) : <tr><td colSpan={headers.length}>{emptyMessage}</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function AdminReports() {
    const [departments, setDepartments] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const generateReport = async (selectedFilters = filters) => {
        setLoading(true);
        setError("");
        try {
            const response = await getAdminReceptionReport(buildRequestParams(selectedFilters));
            setReport(response.data || null);
        } catch (requestError) {
            setReport(null);
            setError(requestError?.response?.data?.message || "Unable to generate the report.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const response = await getDepartments();
                setDepartments(response?.departments || []);
            } catch (loadError) {
                setError(loadError?.response?.data?.message || "Unable to load departments.");
            }
        };

        loadOptions();
        generateReport(initialFilters());
    }, []);

    const handleFieldChange = (event) => {
        const { name, value } = event.target;
        setFilters((current) => ({ ...current, [name]: value }));
    };

    const handleReset = () => {
        const defaults = initialFilters();
        setFilters(defaults);
        generateReport(defaults);
    };

    const renderDateControls = () => {
        if (filters.period === "daily" || filters.period === "weekly") {
            return (
                <div className="report-form-group report-form-wide">
                    <label htmlFor="admin-report-date">{filters.period === "weekly" ? "Select Week" : "Date"}</label>
                    <input id="admin-report-date" type="date" name="date" value={filters.date} onChange={handleFieldChange} />
                </div>
            );
        }

        if (filters.period === "monthly") {
            return <>
                <div className="report-form-group">
                    <label htmlFor="admin-report-month">Month</label>
                    <select id="admin-report-month" name="month" value={filters.month} onChange={handleFieldChange}>
                        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index, 1).toLocaleString("en-US", { month: "long" })}</option>)}
                    </select>
                </div>
                <div className="report-form-group">
                    <label htmlFor="admin-report-year">Year</label>
                    <select id="admin-report-year" name="year" value={filters.year} onChange={handleFieldChange}>
                        {Array.from({ length: 8 }, (_, index) => {
                            const year = new Date().getFullYear() - 3 + index;
                            return <option key={year} value={year}>{year}</option>;
                        })}
                    </select>
                </div>
            </>;
        }

        return <>
            <div className="report-form-group">
                <label htmlFor="admin-report-from">From Date</label>
                <input id="admin-report-from" type="date" name="fromDate" value={filters.fromDate} onChange={handleFieldChange} />
            </div>
            <div className="report-form-group">
                <label htmlFor="admin-report-to">To Date</label>
                <input id="admin-report-to" type="date" name="toDate" value={filters.toDate} onChange={handleFieldChange} />
            </div>
        </>;
    };

    const summary = report?.summary || {};
    const breakdowns = report?.breakdowns || {};
    const summaryCards = [
        ["Total Patients", summary.totalPatients],
        ["Total Visits", summary.totalVisits],
        ["New Visits", summary.newVisits],
        ["Revisit Visits", summary.reVisits],
        ["OP Amount", formatAmount(summary.opAmount)],
        ["Total Discount", formatAmount(summary.totalDiscount)],
        ["Total Amount Collected", formatAmount(summary.totalAmount)],
        ["Total OP Amount", formatAmount(summary.totalOpAmount)],
        ["Cash Collected", formatAmount(summary.cashCollected)],
        ["G-Pay Collected", formatAmount(summary.gpayCollected)],
        ["Free OP Visits", summary.freeOpVisits || 0],
    ];

    return (
        <div className="admin-page reception-reports-page report-print-shell admin-reports-page">
            <div className="admin-page-header">
                <h1>Reception Reports</h1>
            </div>

            <div className="report-controls-card">
                <div className="report-card-header">
                    <div><h3>Report filters</h3></div>
                    <FaFilter className="report-card-icon" />
                </div>
                <div className="report-form-grid">
                    <div className="report-form-group">
                        <label htmlFor="admin-report-receptionist">Receptionist</label>
                        <select id="admin-report-receptionist" name="receptionistId" value={filters.receptionistId} onChange={handleFieldChange}>
                            <option value="all">All Receptionists</option>
                            {(report?.receptionists || []).map((receptionist) => <option key={receptionist.id} value={receptionist.id}>{receptionist.fullName}</option>)}
                        </select>
                    </div>
                    <div className="report-form-group">
                        <label htmlFor="admin-report-period">Report Period</label>
                        <select id="admin-report-period" name="period" value={filters.period} onChange={handleFieldChange}>
                            {REPORT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    {renderDateControls()}
                    <div className="report-form-group">
                        <label htmlFor="admin-report-gender">Gender</label>
                        <select id="admin-report-gender" name="gender" value={filters.gender} onChange={handleFieldChange}>
                            <option value="all">All</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="TRANSGENDER">Transgender</option>
                        </select>
                    </div>
                    <div className="report-form-group">
                        <label htmlFor="admin-report-department">Department</label>
                        <select id="admin-report-department" name="departmentId" value={filters.departmentId} onChange={handleFieldChange}>
                            <option value="all">All Departments</option>
                            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                    </div>
                    <div className="report-form-group">
                        <label htmlFor="admin-report-age">Age Group</label>
                        <select id="admin-report-age" name="ageGroup" value={filters.ageGroup} onChange={handleFieldChange}>
                            <option value="all">All</option><option value="0-13">0 to 13 years</option><option value="13-18">13 to 18 years</option><option value="18+">Above 18 years</option>
                        </select>
                    </div>
                    <div className="report-form-group">
                        <label htmlFor="admin-report-visit-type">Visit Type</label>
                        <select id="admin-report-visit-type" name="visitType" value={filters.visitType} onChange={handleFieldChange}>
                            <option value="all">All</option><option value="NEW">New</option><option value="REVISIT">Revisit</option>
                        </select>
                    </div>
                </div>
                <div className="report-action-row">
                    <button className="report-primary-btn" onClick={() => generateReport()} disabled={loading}>{loading ? "Generating..." : "Generate Report"}</button>
                    <button className="report-secondary-btn" onClick={() => window.print()}><FaPrint /> Print Report</button>
                    <button className="report-tertiary-btn" onClick={handleReset}><FaRedo /> Reset Filters</button>
                </div>
                {error && <div className="report-error">{error}</div>}
            </div>

            {report && <div className="report-output-card">
                <div className="report-print-header">
                    <div className="report-hospital-name">{report.hospitalName}</div>
                    <div className="report-screen-title">ADMIN RECEPTION ACTIVITY</div>
                    <div className="report-print-meta">
                        <div><strong>Period:</strong> {report.period?.rangeLabel || "N/A"}</div>
                        <div><strong>Receptionist:</strong> {report.filters?.receptionistName}</div>
                        <div><strong>Gender:</strong> {report.filters?.gender}</div>
                        <div><strong>Department:</strong> {report.filters?.departmentName}</div>
                        <div><strong>Age Group:</strong> {report.filters?.ageGroup}</div>
                        <div><strong>Visit Type:</strong> {report.filters?.visitType}</div>
                    </div>
                </div>

                <div className="report-summary-grid admin-report-summary">
                    {summaryCards.map(([label, value]) => <div key={label} className="report-summary-card"><span>{label}</span><strong>{value ?? 0}</strong></div>)}
                </div>

                {!report.hasRecords ? <div className="report-empty-state">No records found for the selected filters.</div> : <>
                    <BreakdownTable title="Receptionist Activity" headers={["Receptionist", "Visits", "Amount Collected"]} rows={(breakdowns.receptionists || []).map((row) => ({ key: row.receptionistId, cells: [row.receptionistName, row.totalVisits, formatAmount(row.totalAmount)] }))} />
                    <BreakdownTable title="Gender" headers={["Gender", "Visits"]} rows={(breakdowns.gender || []).map((row) => ({ key: row.gender, cells: [row.gender, row.count] }))} />
                    <BreakdownTable title="Age Distribution" headers={["Age Group", "Visits"]} rows={(breakdowns.ageGroups || []).map((row) => ({ key: row.ageGroup, cells: [row.ageGroup === "18+" ? "Above 18" : row.ageGroup, row.count] }))} />
                    <BreakdownTable title="Department" headers={["Department", "Visits", "New", "Revisit", "Amount Collected"]} rows={(breakdowns.departments || []).filter((row) => row.totalVisits).map((row) => ({ key: row.departmentId, cells: [row.departmentName, row.totalVisits, row.newVisits || 0, row.reVisits || 0, formatAmount(row.totalAmount)] }))} />
                    <BreakdownTable title="Visit Type" headers={["Visit Type", "Visits", "Discount", "Amount Collected"]} rows={(breakdowns.visitTypes || []).map((row) => ({ key: row.visitType, cells: [row.visitType === "NEW" ? "New" : "Revisit", row.totalVisits, formatAmount(row.totalDiscount), formatAmount(row.totalAmount)] }))} />
                    <BreakdownTable title="Scheme / Discount" headers={["Scheme", "Visits", "OP Amount", "Discount", "Final Fee"]} rows={(breakdowns.schemes || []).map((row) => ({ key: row.schemeId ?? "none", cells: [row.schemeName, row.totalVisits, formatAmount(row.opAmount), formatAmount(row.totalDiscount), formatAmount(row.totalAmount)] }))} />

                    <section className="admin-report-section">
                        <h3>Patient and Visit Details</h3>
                        <div className="report-table-wrapper">
                            <table className="report-data-table admin-report-details-table">
                                <thead><tr><th>Visit Date</th><th>Patient</th><th>UHID / Phone</th><th>Gender</th><th>Age</th><th>Department</th><th>Scheme</th><th>Discount</th><th>OP Amount</th><th>Final Fee</th><th>Visit Type</th><th>Receptionist</th><th>Patient Registered By</th></tr></thead>
                                <tbody>{report.visits.map((visit) => <tr key={visit.visitId}>
                                    <td>{new Date(visit.visitDate).toLocaleString()}</td><td>{visit.patientName}</td><td>{visit.uhid}<br />{visit.phone || ""}</td><td>{visit.gender}</td><td>{visit.age ?? "N/A"}</td><td>{visit.department}</td><td>{visit.scheme}</td><td>{formatAmount(visit.discountAmount)}</td><td>{formatAmount(visit.opFee)}</td><td>{formatAmount(visit.finalFee)}</td><td>{visit.visitType === "NEW" ? "New" : "Revisit"}</td><td>{visit.receptionist}</td><td>{visit.patientRegisteredBy}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                    </section>
                </>}
            </div>}
        </div>
    );
}

export default AdminReports;
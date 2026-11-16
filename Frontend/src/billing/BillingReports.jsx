import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPrint } from "react-icons/fa";
import { billingApi } from "./billingApi";
import "../styles/Billing.css";

const today = new Date().toISOString().slice(0, 10);
const HOSPITAL_NAME = import.meta.env.VITE_HOSPITAL_NAME || "GENERAL HOSPITAL THRISSUR";

function money(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function BillingReports() {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = currentUser?.role?.name?.toUpperCase() === "ADMIN";
    const receiptPath = isAdmin ? "/dashboard/billing-reports/receipt" : "/billing/receipt";
    const now = new Date();
    const [filters, setFilters] = useState({
        period: "daily",
        date: today,
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        from: today,
        to: today,
        method: "",
        staffId: "",
    });
    const [staff, setStaff] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function runReport(event) {
        event?.preventDefault();
        setLoading(true);
        setError("");
        try {
            setReport(await billingApi.report(filters));
        } catch (reportError) {
            setError(reportError.message);
            setReport(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;
        if (isAdmin) billingApi.staff().then((rows) => {
            if (!cancelled) setStaff(rows);
        }).catch((loadError) => {
            if (!cancelled) setError(loadError.message);
        });
        billingApi.report({ period: "daily", date: today }).then((result) => {
            if (!cancelled) setReport(result);
        }).catch((loadError) => {
            if (!cancelled) setError(loadError.message);
        });
        return () => { cancelled = true; };
    }, [isAdmin]);

    function setFilter(name, value) {
        setFilters((current) => ({ ...current, [name]: value }));
    }

    return (
        <div className={`billing-page billing-report-print-shell${isAdmin ? " admin-page" : ""}`}>
            <header className={isAdmin ? "admin-page-header" : "billing-page-header"}>
                {!isAdmin && <p>BILLING</p>}
                <h1>{isAdmin ? "Billing Reports" : "Reports"}</h1>
                {!isAdmin && <span>Your billing and collection activity.</span>}
            </header>
            <section className="billing-card billing-report-controls">
                <form className="billing-form-grid" onSubmit={runReport}>
                    <label>Report period<select value={filters.period} onChange={(event) => setFilter("period", event.target.value)}>
                        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom date range</option>
                    </select></label>
                    {["daily", "weekly"].includes(filters.period) && <label>{filters.period === "weekly" ? "Week containing" : "Date"}<input type="date" required value={filters.date} onChange={(event) => setFilter("date", event.target.value)} /></label>}
                    {filters.period === "monthly" && <>
                        <label>Month<select value={filters.month} onChange={(event) => setFilter("month", event.target.value)}>
                            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleString(undefined, { month: "long" })}</option>)}
                        </select></label>
                        <label>Year<input type="number" min="2000" max="2200" value={filters.year} onChange={(event) => setFilter("year", event.target.value)} /></label>
                    </>}
                    {filters.period === "custom" && <>
                        <label>From<input type="date" required value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label>
                        <label>To<input type="date" required value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label>
                    </>}
                    <label>Payment method<select value={filters.method} onChange={(event) => setFilter("method", event.target.value)}>
                        <option value="">All methods</option><option value="CASH">Cash</option><option value="GPAY">GPay</option>
                    </select></label>
                    {isAdmin && <label>Billing staff<select value={filters.staffId} onChange={(event) => setFilter("staffId", event.target.value)}>
                        <option value="">All staff — hospital total</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.employeeId}){member.status !== "ACTIVE" ? ` · ${member.status}` : ""}</option>)}
                    </select></label>}
                    <div className="billing-form-actions billing-report-actions">
                        <button className="billing-primary-button" disabled={loading}>{loading ? "Loading report…" : "Run report"}</button>
                        <button className="billing-secondary-button" type="button" disabled={!report} onClick={() => window.print()}><FaPrint /> Print report</button>
                    </div>
                </form>
                {error && <p className="billing-error" role="alert">{error}</p>}
            </section>

            {report && <>
                <section className="billing-report-output">
                    <header className="billing-report-print-header">
                        <h1>{HOSPITAL_NAME}</h1>
                        <h2>Billing Report</h2>
                        <p>
                            Period: {new Date(report.from).toLocaleDateString()} – {new Date(report.to).toLocaleDateString()}
                            {report.paymentMethod ? ` · Payment method: ${report.paymentMethod}` : ""}
                            {isAdmin && filters.staffId ? ` · Billing staff: ${staff.find((member) => String(member.id) === filters.staffId)?.fullName || "Selected staff"}` : ""}
                        </p>
                    </header>
                <section className="billing-summary-grid">
                    <div><span>Original bill amount</span><strong>{money(report.grossServiceCharges)}</strong></div>
                    <div><span>Total discounts</span><strong>{money(report.totalDiscounts)}</strong></div>
                    <div><span>Miscellaneous discounts</span><strong>{money(report.miscellaneousDiscounts)}</strong></div>
                    <div><span>Net payable (billed)</span><strong>{money(report.netPayable)}</strong></div>
                    <div><span>Actual collected</span><strong>{money(report.amountCollected)}</strong></div>
                    <div><span>Outstanding balance</span><strong>{money(report.outstandingBalance)}</strong></div>
                    <div><span>Refunds / reversals</span><strong>{money(report.reversals)}</strong></div>
                </section>
                <p className="billing-report-note">
                    {new Date(report.from).toLocaleDateString()} – {new Date(report.to).toLocaleDateString()} · {report.transactionCount} bills · {report.paymentTransactionCount} payment/reversal transactions.
                    {report.paymentMethod ? ` Collections filtered to ${report.paymentMethod}. Billed amounts remain independent of payment method.` : ""}
                </p>
                <section className="billing-card">
                    <h2>Collections by payment method</h2>
                    <div className="billing-summary-grid billing-collection-grid">
                        {["CASH", "GPAY"].map((method) => <div key={method}>
                            <span>{method === "CASH" ? "Cash" : "GPay"} collected / reversed</span>
                            <strong>{money(report.collections[method].netCollected)}</strong>
                            <small>Received {money(report.collections[method].grossCollected)} · Reversed {money(report.collections[method].reversed)} · {report.collections[method].transactionCount} transactions</small>
                        </div>)}
                    </div>
                </section>
                {isAdmin && !filters.staffId && <section className="billing-card">
                    <h2>Billing staff summary</h2>
                    <div className="billing-table-wrap"><table className="billing-table">
                        <thead><tr><th>Staff member</th><th>Bills</th><th>Gross</th><th>Total discounts</th><th>Miscellaneous discounts</th><th>Net billed</th><th>Collected by staff</th><th>Payment transactions</th></tr></thead>
                        <tbody>{report.staff.map((member) => <tr key={member.staffId}>
                            <td>{member.staffName} ({member.employeeId})</td><td>{member.billCount}</td>
                            <td>{money(member.grossAmount)}</td><td>{money(member.discountAmount)}</td><td>{money(member.miscellaneousDiscountAmount)}</td>
                            <td>{money(member.netPayable)}</td><td>{money(member.amountCollected)}</td><td>{member.paymentTransactionCount}</td>
                        </tr>)}</tbody>
                    </table></div>
                </section>}
                <section className="billing-card">
                    <h2>Service-wise summary</h2>
                    <p className="billing-report-note">Service-wise discounts include scheme discounts only. Miscellaneous adjustments are bill-level discounts shown in the bill list and report totals.</p>
                    <div className="billing-table-wrap"><table className="billing-table">
                        <thead><tr><th>Service</th><th>Quantity</th><th>Gross</th><th>Scheme discounts</th><th>Net after scheme discount</th></tr></thead>
                        <tbody>{report.services.map((row) => <tr key={row.serviceId}>
                            <td>{row.serviceName}</td><td>{row.quantity}</td><td>{money(row.grossAmount)}</td><td>{money(row.discountAmount)}</td><td>{money(row.netPayable)}</td>
                        </tr>)}</tbody>
                    </table></div>
                </section>
                <section className="billing-card">
                    <h2>Bills</h2>
                    <div className="billing-table-wrap"><table className="billing-table">
                        <thead><tr><th>Bill number</th><th>Date</th><th>Patient</th><th>UHID</th><th>Category</th><th>Remarks</th><th>Original bill</th><th>Scheme discount</th><th>Adjustment</th><th>Adjustment applied by</th><th>Miscellaneous amount</th><th>Miscellaneous discount</th><th>Net billed</th><th>Collected</th><th>Outstanding</th><th>Status</th><th className="billing-report-actions">Receipt</th></tr></thead>
                        <tbody>{report.bills.map((bill) => <tr key={bill.billNumber}>
                            <td>{bill.billNumber}</td>
                            <td>{new Date(bill.createdAt).toLocaleString()}</td>
                            <td>{bill.patientName}</td>
                            <td>{bill.uhid}</td>
                            <td>{bill.category}</td>
                            <td className="billing-report-remarks" title={bill.remarks || ""}>{bill.remarks?.trim() || "—"}</td>
                            <td>{money(bill.originalBillAmount)}</td>
                            <td>{money(bill.schemeDiscountAmount)}</td>
                            <td>{bill.adjustmentType || "—"}</td>
                            <td>{bill.adjustmentAppliedBy || "—"}</td>
                            <td>{bill.adjustmentType === "MISCELLANEOUS" ? money(bill.miscellaneousAmount) : "—"}</td>
                            <td>{bill.adjustmentType === "MISCELLANEOUS" ? money(bill.miscellaneousDiscountAmount) : "—"}</td>
                            <td>{money(bill.netPayable)}</td>
                            <td>{money(bill.amountCollected)}</td>
                            <td>{money(bill.outstandingAmount)}</td>
                            <td>{bill.status}</td>
                            <td className="billing-report-actions">
                                <button className={isAdmin ? "admin-row-action-button" : "billing-link-button"} type="button" onClick={() => navigate(`${receiptPath}/${encodeURIComponent(bill.billNumber)}?print=1`)}>
                                    <FaPrint /> Print
                                </button>
                            </td>
                        </tr>)}
                        {!report.bills.length && <tr><td colSpan="17">No bills for the selected filters.</td></tr>}
                        </tbody>
                    </table></div>
                </section>
                <section className="billing-card">
                    <h2>Scheme-wise summary</h2>
                    <p className="billing-report-note">This summary includes scheme discounts only; miscellaneous adjustments are reported separately at bill level.</p>
                    <div className="billing-table-wrap"><table className="billing-table">
                        <thead><tr><th>Scheme</th><th>Bills</th><th>Gross</th><th>Scheme discounts</th><th>Net after scheme discount</th></tr></thead>
                        <tbody>{report.schemes.map((row) => <tr key={row.code}>
                            <td>{row.name}</td><td>{row.billCount}</td><td>{money(row.grossAmount)}</td><td>{money(row.discountAmount)}</td><td>{money(row.netPayable)}</td>
                        </tr>)}</tbody>
                    </table></div>
                </section>
                </section>
            </>}
        </div>
    );
}

export default BillingReports;

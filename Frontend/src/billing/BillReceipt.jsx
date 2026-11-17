import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { billingApi } from "./billingApi";
import "../styles/Billing.css";

const HOSPITAL_NAME = import.meta.env.VITE_HOSPITAL_NAME || "GENERAL HOSPITAL THRISSUR";
const HOSPITAL_ADDRESS = import.meta.env.VITE_HOSPITAL_ADDRESS || "GH THRISSUR, THRISSUR- 680001, Ph: 04872427383";

function money(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function BillReceipt() {
    const { billNumber } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = currentUser?.role?.name?.toUpperCase() === "ADMIN";
    const [bill, setBill] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const autoPrintRequested = useRef(false);
    const shouldAutoPrint = new URLSearchParams(location.search).get("print") === "1";

    const loadBill = useCallback(async () => {
        setLoading(true);
        try {
            setBill(await billingApi.bill(billNumber));
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [billNumber]);

    useEffect(() => { loadBill(); }, [loadBill]);

    useEffect(() => {
        if (shouldAutoPrint && bill && !loading && !autoPrintRequested.current) {
            autoPrintRequested.current = true;
            window.print();
        }
    }, [bill, loading, shouldAutoPrint]);

    async function reversePayment(paymentId) {
        const reason = window.prompt("Enter the reason for reversing this payment:");
        if (reason === null) return;
        setError("");
        setSaving(true);
        try {
            await billingApi.reversePayment(paymentId, reason);
            await loadBill();
        } catch (reversalError) {
            setError(reversalError.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading && !bill) return <div className="billing-page">Loading receipt…</div>;
    if (!bill) return <div className="billing-page"><p className="billing-error">{error || "Bill not found"}</p></div>;

    const createdDate = new Date(bill.createdAt).toLocaleString();
    const outstanding = Number(bill.outstandingAmount);

    return (
        <div className="bill-print-page">
            <div className="bill-print-actions">
                <button className="billing-secondary-button" type="button" onClick={() => navigate(isAdmin ? "/dashboard/billing-reports" : "/billing")}>Dashboard</button>
                <button className="billing-primary-button" type="button" onClick={() => window.print()}>Print receipt</button>
            </div>
            {error && <p className="billing-error" role="alert">{error}</p>}
            <article className="bill-receipt">
                <header className="bill-receipt-header">
                    <h1>{HOSPITAL_NAME}</h1>
                    {HOSPITAL_ADDRESS && <p>{HOSPITAL_ADDRESS}</p>}
                    <h2>PAYMENT RECEIPT</h2>
                </header>
                <div className="bill-receipt-meta">
                    <div><span>Bill number</span><strong>{bill.billNumber}</strong></div>
                    <div><span>Date</span><strong>{createdDate}</strong></div>
                    <div><span>Category</span><strong>{bill.category}</strong></div>
                    <div><span>Scheme</span><strong>{bill.schemeSnapshot?.name || "None"}</strong></div>
                </div>
                <section className="bill-patient-details">
                    <h3>Patient details</h3>
                    <p><strong>Name:</strong> {bill.patient.firstName}</p>
                    <p><strong>UHID:</strong> {bill.patient.uhid} <span className="bill-print-separator">|</span> <strong>Age/Gender:</strong> {bill.patient.age} / {bill.patient.gender}</p>
                    {bill.patient.phone && <p><strong>Phone:</strong> {bill.patient.phone}</p>}
                </section>
                <table className="bill-receipt-table">
                    <thead><tr><th>Service</th><th>Tariff ({bill.category})</th><th>Qty</th><th>Gross</th><th>Scheme discount</th><th>Net</th></tr></thead>
                    <tbody>{bill.items.map((item) => <tr key={item.id}>
                        <td>{item.serviceNameSnapshot}</td>
                        <td>{money(item.tariffUnitPrice)}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.grossAmount)}</td>
                        <td>{money(item.discountAmount)}</td>
                        <td>{money(item.netAmount)}</td>
                    </tr>)}</tbody>
                </table>
                <div className="bill-receipt-totals">
                    <div><span>Original bill amount</span><strong>{money(bill.grossAmount)}</strong></div>
                    <div><span>Scheme discount / waiver</span><strong>− {money(bill.discountAmount)}</strong></div>
                    {bill.adjustmentType === "MISCELLANEOUS" && <>
                        <div><span>Adjustment type</span><strong>MISCELLANEOUS</strong></div>
                        <div><span>Miscellaneous amount</span><strong>{money(bill.miscellaneousAmount)}</strong></div>
                        <div><span>Actual miscellaneous discount</span><strong>− {money(bill.miscellaneousDiscountAmount)}</strong></div>
                    </>}
                    <div className="bill-receipt-total"><span>Final payable</span><strong>{money(bill.netPayable)}</strong></div>
                    <div><span>Payment received</span><strong>{money(bill.amountCollected)}</strong></div>
                    {outstanding > 0 && <div><span>Outstanding</span><strong>{money(outstanding)}</strong></div>}
                </div>
                <section className="bill-payment-status">
                    <h3>Payment status: {bill.status}</h3>
                    {bill.payments.length === 0 ? <p>No collection recorded.</p> : bill.payments.map((payment) => <p key={payment.id} className="bill-payment-item">
                        <span>{payment.method} · {money(payment.amount)} · {payment.status}
                            {payment.status === "REVERSED" ? ` · Reversed: ${new Date(payment.reversedAt).toLocaleString()}` : ` · ${new Date(payment.confirmedAt).toLocaleString()}`}
                            {" · Handled by "}{payment.handledByUser.fullName}
                            {payment.status === "REVERSED" && payment.reversalReason ? ` · ${payment.reversalReason}` : ""}
                        </span>
                        {isAdmin && payment.status === "CONFIRMED" && <button className="billing-link-button billing-danger-link" type="button" disabled={saving} onClick={() => reversePayment(payment.id)}>Reverse</button>}
                    </p>)}
                    {bill.status === "WAIVED" && <p>Zero-payable bill — discount/waiver recorded; no collection taken.</p>}
                </section>
                <section className="bill-remarks">
                    <h3>Remarks</h3>
                    <p>{bill.remarks?.trim() || "—"}</p>
                </section>
                <footer className="bill-receipt-footer">
                    Billed by {bill.createdByUser.fullName}
                    {bill.adjustmentType === "MISCELLANEOUS" && ` · Miscellaneous adjustment applied by ${bill.createdByUser.fullName} on ${createdDate}`}
                    {" · This is a computer-generated receipt."}
                </footer>
            </article>
        </div>
    );
}

export default BillReceipt;

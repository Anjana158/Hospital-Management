import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { billingApi } from "./billingApi";
import "../styles/Billing.css";

function currentTariff(service, category) {
    return service.tariffs.find((tariff) => tariff.category === category);
}

function validPhone(value) {
    return /^\d{10}$/.test((value || "").trim());
}

function calculateAgeFromDate(dateString) {
    if (!dateString) {
        return "";
    }

    const birthDate = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) {
        return "";
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }

    return age;
}

function calculateApproximateDob(age) {
    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 0 || numericAge > 150) {
        return "";
    }

    const currentYear = new Date().getFullYear();
    return `${currentYear - numericAge}-01-01`;
}

function sanitizeTextInput(value) {
    return value.replace(/[^\p{L}\p{M}\s.'-]/gu, "");
}

function NewBill() {
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [schemes, setSchemes] = useState([]);
    const [patientQuery, setPatientQuery] = useState("");
    const [patients, setPatients] = useState([]);
    const [searchedQuery, setSearchedQuery] = useState("");
    const [patient, setPatient] = useState(null);
    const [registrationOpen, setRegistrationOpen] = useState(false);
    const [registrationForm, setRegistrationForm] = useState({
        name: "",
        phone: "",
        gender: "",
        dateOfBirth: "",
        age: "",
        schemeId: "",
        schemeAdditionalInformation: {},
    });
    const [duplicatePatients, setDuplicatePatients] = useState([]);
    const [registrationError, setRegistrationError] = useState("");
    const [registrationNotice, setRegistrationNotice] = useState("");
    const [schemeLoadError, setSchemeLoadError] = useState("");
    const [registeringPatient, setRegisteringPatient] = useState(false);
    const [category, setCategory] = useState("APL");
    const [items, setItems] = useState([{ serviceId: "", quantity: 1 }]);
    const [quote, setQuote] = useState(null);
    const [searching, setSearching] = useState(false);
    const [quoting, setQuoting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("");
    const [posConfirmed, setPosConfirmed] = useState(false);
    const [miscellaneousEnabled, setMiscellaneousEnabled] = useState(false);
    const [miscellaneousAmount, setMiscellaneousAmount] = useState("");
    const [remarks, setRemarks] = useState("");
    const [error, setError] = useState("");
    const idempotencyKey = useRef(null);

    useEffect(() => {
        billingApi.services().then(setServices).catch((loadError) => setError(loadError.message));
        billingApi.patientSchemes().then(setSchemes).catch((loadError) => setSchemeLoadError(loadError.message));
    }, []);

    useEffect(() => {
        if (patient || patientQuery.trim().length < 2) {
            setPatients([]);
            setSearchedQuery("");
            return undefined;
        }
        setSearchedQuery("");
        let cancelled = false;
        const query = patientQuery.trim();
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const matches = await billingApi.searchPatients(query);
                if (!cancelled) {
                    setPatients(matches);
                    setSearchedQuery(query);
                }
            } catch (searchError) {
                if (!cancelled) setError(searchError.message);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [patientQuery, patient]);

    const quoteItems = useMemo(() => items
        .filter((item) => item.serviceId)
        .map((item) => ({ serviceId: Number(item.serviceId), quantity: Number(item.quantity) })), [items]);

    useEffect(() => {
        setQuote(null);
        setError("");
        idempotencyKey.current = null;
        if (!patient || !quoteItems.length || quoteItems.length !== items.length || quoteItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
            setQuoting(false);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setQuoting(true);
            try {
                const calculated = await billingApi.quote({ patientId: patient.id, category, items: quoteItems });
                if (!cancelled) {
                    setQuote(calculated);
                    if (Number(calculated.netPayable) === 0) {
                        setPaymentMethod("");
                        setGpayConfirmed(false);
                    }
                }
            } catch (quoteError) {
                if (!cancelled) setError(quoteError.message);
            } finally {
                if (!cancelled) setQuoting(false);
            }
        }, 150);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [patient, category, quoteItems, items.length]);

    function updateItem(index, field, value) {
        setItems((current) => current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item));
    }

    function selectPatient(record) {
        setPatient(record);
        setPatientQuery(`${record.uhid} - ${record.firstName}`);
        setPatients([]);
        setDuplicatePatients([]);
        setRegistrationOpen(false);
        setRegistrationError("");
        setRegistrationNotice("");
        setSearching(false);
        setPaymentMethod("");
        setGpayConfirmed(false);
    }

    function clearPatient() {
        setPatient(null);
        setPatientQuery("");
        setQuote(null);
        setItems([{ serviceId: "", quantity: 1 }]);
        setRegistrationNotice("");
    }

    function updateRegistrationField(name, value) {
        if (name === "name") {
            const safeName = sanitizeTextInput(value);
            setRegistrationForm((current) => ({ ...current, name: safeName }));
            setRegistrationError("");
            setDuplicatePatients([]);
            return;
        }

        if (name === "phone") {
            const digits = value.replace(/\D/g, "").slice(0, 10);
            setRegistrationForm((current) => ({ ...current, phone: digits }));
            setRegistrationError("");
            setDuplicatePatients([]);
            return;
        }

        if (name === "dateOfBirth") {
            const calculatedAge = calculateAgeFromDate(value);
            setRegistrationForm((current) => ({
                ...current,
                dateOfBirth: value,
                age: calculatedAge,
            }));
            setRegistrationError("");
            setDuplicatePatients([]);
            return;
        }

        if (name === "age") {
            if (value === "") {
                setRegistrationForm((current) => ({ ...current, age: "", dateOfBirth: "" }));
                setRegistrationError("");
                setDuplicatePatients([]);
                return;
            }

            const numericAge = Number(value);
            const approximateDob = calculateApproximateDob(value);
            setRegistrationForm((current) => ({
                ...current,
                age: value,
                dateOfBirth: approximateDob,
            }));
            setRegistrationError("");
            setDuplicatePatients([]);
            return;
        }

        setRegistrationForm((current) => ({ ...current, [name]: value }));
        setRegistrationError("");
        setDuplicatePatients([]);
    }

    function updateRegistrationScheme(schemeId) {
        const scheme = schemes.find((row) => String(row.id) === schemeId);
        setRegistrationForm((current) => ({
            ...current,
            schemeId,
            schemeAdditionalInformation: Object.fromEntries(
                (scheme?.collectAdditionalInformation ? scheme.additionalInformationFields : [])
                    .map((field) => [field.key, ""])
            ),
        }));
        setRegistrationError("");
    }

    async function registerPatient() {
        const name = registrationForm.name.trim();
        const phone = registrationForm.phone.trim();
        const age = Number(registrationForm.age);

        if (!name) {
            setRegistrationError("Patient name is required.");
            return;
        }
        if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name)) {
            setRegistrationError("Name can only include letters, spaces, apostrophes, dots, and hyphens.");
            return;
        }
        if (phone && !validPhone(phone)) {
            setRegistrationError("Phone number must contain exactly 10 digits.");
            return;
        }
        if (!registrationForm.gender) {
            setRegistrationError("Select the patient's gender.");
            return;
        }
        if (!registrationForm.dateOfBirth) {
            setRegistrationError("Date of birth is required.");
            return;
        }
        if (registrationForm.age === "" || !Number.isInteger(age) || age < 0 || age > 150) {
            setRegistrationError("Age is required and must be a whole number between 0 and 150.");
            return;
        }
        if (!registrationForm.schemeId) {
            setRegistrationError("Select the patient's scheme.");
            return;
        }

        const selectedScheme = schemes.find((row) => String(row.id) === registrationForm.schemeId);
        const payload = {
            firstName: name,
            phone,
            gender: registrationForm.gender,
            dateOfBirth: registrationForm.dateOfBirth,
            age,
            schemeId: selectedScheme ? Number(selectedScheme.id) : undefined,
            schemeAdditionalInformation: selectedScheme
                ? (selectedScheme.collectAdditionalInformation ? selectedScheme.additionalInformationFields : [])
                    .map((field) => ({ key: field.key, value: registrationForm.schemeAdditionalInformation[field.key] || "" }))
                : [],
        };

        setRegisteringPatient(true);
        setRegistrationError("");
        setDuplicatePatients([]);
        try {
            const createdPatient = await billingApi.registerPatient(payload);
            selectPatient(createdPatient);
            setRegistrationNotice("Patient registered and selected for billing.");
        } catch (registrationRequestError) {
            setRegistrationError(registrationRequestError.message);
            if (registrationRequestError.code === "PATIENT_DUPLICATE_PHONE") {
                setDuplicatePatients(registrationRequestError.duplicates || []);
            }
        } finally {
            setRegisteringPatient(false);
        }
    }

    async function submitBill(event) {
        event.preventDefault();
        if (!quote || !patient) return;
        if (miscellaneousEnabled && !remarks.trim()) {
            setError("A remark is required when applying a miscellaneous adjustment.");
            return;
        }
        setError("");
        setSubmitting(true);
        const payload = {
            patientId: patient.id,
            category,
            items: quoteItems,
            remarks,
            miscellaneousAmount: miscellaneousEnabled ? Number(miscellaneousAmount) : null,
            paymentMethod: finalPayable > 0 ? paymentMethod : null,
            posConfirmed: finalPayable > 0 && paymentMethod === "POS" && posConfirmed,
        };
        const fingerprint = JSON.stringify(payload);
        if (!idempotencyKey.current || idempotencyKey.current.fingerprint !== fingerprint) {
            idempotencyKey.current = {
                fingerprint,
                key: globalThis.crypto?.randomUUID?.() || `bill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            };
        }
        try {
            const bill = await billingApi.createBill({ ...payload, idempotencyKey: idempotencyKey.current.key });
            navigate(`/billing/receipt/${encodeURIComponent(bill.billNumber)}`);
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSubmitting(false);
        }
    }

    const netPayable = Number(quote?.netPayable || 0);
    const parsedMiscellaneousAmount = miscellaneousAmount.trim() === "" ? null : Number(miscellaneousAmount);
    const miscellaneousAmountValid = !miscellaneousEnabled || (
        parsedMiscellaneousAmount !== null &&
        Number.isFinite(parsedMiscellaneousAmount) &&
        parsedMiscellaneousAmount >= 0 &&
        parsedMiscellaneousAmount <= netPayable &&
        Math.abs(parsedMiscellaneousAmount * 100 - Math.round(parsedMiscellaneousAmount * 100)) < 1e-8
    );
    const finalPayable = miscellaneousEnabled && miscellaneousAmountValid
        ? parsedMiscellaneousAmount
        : netPayable;
    const miscellaneousDiscount = miscellaneousEnabled && miscellaneousAmountValid
        ? netPayable - finalPayable
        : null;
    const servicesUsed = items.map((item) => item.serviceId).filter(Boolean);
    const selectedRegistrationScheme = schemes.find((scheme) => String(scheme.id) === registrationForm.schemeId);

    return (
        <div className="billing-page">
            <header className="billing-page-header">
                <h1>Create New Bill</h1>
            </header>
            {error && <p className="billing-error" role="alert">{error}</p>}

            <form className="billing-workflow" onSubmit={submitBill}>
                <section className="billing-card">
                    <h2>Patient and category</h2>
                    <label className="billing-field">
                        Search registered patients
                        <input value={patientQuery} disabled={Boolean(patient)} onChange={(event) => setPatientQuery(event.target.value)} placeholder="UHID, patient name, or phone" autoComplete="off" />
                    </label>
                    {searching && <p className="billing-muted">Searching…</p>}
                    {!searching && searchedQuery === patientQuery.trim() && searchedQuery.length >= 2 && patients.length === 0 && (
                        <div className="billing-patient-not-found">
                            <p>Patient not found. Register a new patient to continue.</p>
                            <button className="billing-secondary-button" type="button" onClick={() => {
                                setRegistrationOpen(true);
                                setRegistrationError("");
                                setDuplicatePatients([]);
                            }}>Register New Patient</button>
                        </div>
                    )}
                    {patients.length > 0 && <ul className="billing-patient-results">
                        {patients.map((record) => <li key={record.id}>
                            <button type="button" onClick={() => selectPatient(record)}>
                                <strong>{record.uhid}</strong> — {record.firstName}
                                <span>{record.phone || "No phone"}{record.scheme ? ` · ${record.scheme.name}` : ""}</span>
                            </button>
                        </li>)}
                    </ul>}
                    {patient && <div className="billing-selected-patient">
                        <strong>{patient.firstName}</strong>
                        <span>{patient.uhid} · Age {patient.age} · {patient.gender}{patient.scheme ? ` · Scheme: ${patient.scheme.name}` : " · No assigned scheme"}</span>
                        <button type="button" className="billing-link-button" onClick={clearPatient}>Change patient</button>
                    </div>}
                    {registrationNotice && <p className="billing-notice" role="status">{registrationNotice}</p>}
                    {registrationOpen && !patient && <div className="billing-registration-panel">
                        <h3>Register New Patient</h3>
                        {schemeLoadError && <p className="billing-error" role="alert">Unable to load active schemes: {schemeLoadError} You may continue without a scheme.</p>}
                        <div className="billing-form-grid">
                            <label>Patient name<input required value={registrationForm.name} onChange={(event) => updateRegistrationField("name", event.target.value)} autoComplete="name" /></label>
                            <label>Phone number<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={registrationForm.phone} onChange={(event) => updateRegistrationField("phone", event.target.value)} autoComplete="tel" /></label>
                            <label>Gender<select required value={registrationForm.gender} onChange={(event) => updateRegistrationField("gender", event.target.value)}>
                                <option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="TRANSGENDER">Transgender</option>
                            </select></label>
                            <label>Age<input required type="number" min="0" max="150" step="1" inputMode="numeric" value={registrationForm.age} onChange={(event) => updateRegistrationField("age", event.target.value)} /></label>
                            <label>Date of birth<input required type="date" max={new Date().toISOString().slice(0, 10)} value={registrationForm.dateOfBirth} onChange={(event) => updateRegistrationField("dateOfBirth", event.target.value)} /></label>
                            <label>Patient scheme<select required value={registrationForm.schemeId} onChange={(event) => updateRegistrationScheme(event.target.value)}>
                                <option value="">Select scheme</option>{schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}</option>)}
                            </select></label>
                            {selectedRegistrationScheme?.collectAdditionalInformation
                                && selectedRegistrationScheme.additionalInformationFields.map((field) => (
                                    <label key={field.key}>{field.label}<input value={registrationForm.schemeAdditionalInformation[field.key] || ""} onChange={(event) => setRegistrationForm((current) => ({
                                        ...current,
                                        schemeAdditionalInformation: { ...current.schemeAdditionalInformation, [field.key]: event.target.value },
                                    }))} /></label>
                                ))}
                        </div>
                        {registrationError && <p className="billing-error" role="alert">{registrationError}</p>}
                        {duplicatePatients.length > 0 && <div className="billing-patient-results billing-possible-duplicates">
                            <p>Possible matching patients found. Select the correct existing record to continue:</p>
                            {duplicatePatients.map((record) => <button key={record.id} type="button" disabled={record.status !== "ACTIVE" || record.archivedAt} onClick={() => selectPatient(record)}>
                                <strong>{record.uhid}</strong> — {record.firstName}
                                <span>{record.phone || record.alternatePhone || "No phone"}{record.scheme ? ` · ${record.scheme.name}` : ""} · {record.status === "ACTIVE" && !record.archivedAt ? "Select this patient" : "Inactive patient — cannot bill"}</span>
                            </button>)}
                        </div>}
                        <div className="billing-form-actions">
                            <button className="billing-primary-button" type="button" disabled={registeringPatient} onClick={registerPatient}>
                                {registeringPatient ? "Registering…" : "Save and continue"}
                            </button>
                            <button className="billing-secondary-button" type="button" disabled={registeringPatient} onClick={() => setRegistrationOpen(false)}>Cancel</button>
                        </div>
                    </div>}
                    <label className="billing-field billing-category-field">
                        Patient category
                        <select value={category} onChange={(event) => setCategory(event.target.value)}>
                            <option value="APL">APL</option><option value="BPL">BPL</option>
                        </select>
                    </label>
                </section>

                <section className="billing-card">
                    <div className="billing-card-heading">
                        <h2>Services</h2>
                        <button className="billing-secondary-button" type="button" onClick={() => setItems((current) => [...current, { serviceId: "", quantity: 1 }])}>Add service</button>
                    </div>
                    {services.length === 0 && <p className="billing-muted">No active services have tariffs yet. Ask Admin to configure services before billing.</p>}
                    {items.map((item, index) => {
                        const service = services.find((row) => String(row.id) === String(item.serviceId));
                        const tariff = service && currentTariff(service, category);
                        return <div className="billing-service-row" key={index}>
                            <label>Service<select required value={item.serviceId} onChange={(event) => updateItem(index, "serviceId", event.target.value)}>
                                <option value="">Select service</option>
                                {services.filter((row) => !servicesUsed.includes(String(row.id)) || String(row.id) === String(item.serviceId)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                            </select></label>
                            <label>Quantity<input required type="number" min="1" max="1000" step="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
                            <div className="billing-tariff-display">Current {category}: {tariff ? `${tariff.amount}${tariff.isFree ? " (free)" : ""}` : "—"}</div>
                            {items.length > 1 && <button className="billing-link-button billing-danger-link" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
                        </div>;
                    })}
                    {quoting && <p className="billing-muted">Calculating scheme discount…</p>}
                    {quote && <div className="billing-totals">
                        <div><span>Original bill amount</span><strong>₹{quote.grossAmount}</strong></div>
                        <div><span>Scheme discount / waiver</span><strong>− ₹{quote.discountAmount}</strong></div>
                        {miscellaneousEnabled && <>
                            <div><span>Miscellaneous amount</span><strong>{miscellaneousAmountValid ? `₹${finalPayable.toFixed(2)}` : "Enter a valid amount"}</strong></div>
                            <div><span>Miscellaneous discount</span><strong>{miscellaneousDiscount === null ? "—" : `− ₹${miscellaneousDiscount.toFixed(2)}`}</strong></div>
                        </>}
                        <div className="billing-total-due"><span>Final payable</span><strong>₹{finalPayable.toFixed(2)}</strong></div>
                    </div>}
                </section>

                <section className="billing-card">
                    <h2>Payment</h2>
                    <div className="billing-adjustment-panel">
                        <label className="billing-checkbox">
                            <input type="checkbox" checked={miscellaneousEnabled} onChange={(event) => {
                                setMiscellaneousEnabled(event.target.checked);
                                setMiscellaneousAmount("");
                            }} />
                            Miscellaneous
                        </label>
                        {miscellaneousEnabled && <>
                            <label className="billing-adjustment-amount">
                                Miscellaneous Amount (final amount approved for payment)
                                <input required type="number" min="0" max={quote?.netPayable || 0} step="0.01" value={miscellaneousAmount} onChange={(event) => {
                                    setMiscellaneousAmount(event.target.value);
                                    if (Number(event.target.value) === 0) {
                                        setPaymentMethod("");
                                        setGpayConfirmed(false);
                                    }
                                }} />
                            </label>
                            <p className="billing-muted">Enter the final amount only after Superintendent approval. This records the adjustment; it does not record an approval.</p>
                        </>}
                    </div>
                    <label className="billing-field billing-remarks-field">
                        Remarks {miscellaneousEnabled ? "(required)" : "(optional)"}
                        <textarea
                            required={miscellaneousEnabled}
                            aria-invalid={miscellaneousEnabled && !remarks.trim()}
                            aria-describedby={miscellaneousEnabled ? "miscellaneous-remark-validation" : undefined}
                            rows="4"
                            maxLength="10000"
                            value={remarks}
                            onChange={(event) => setRemarks(event.target.value)}
                            placeholder="Add notes or additional information for this bill"
                        />
                        {miscellaneousEnabled && !remarks.trim() && <span id="miscellaneous-remark-validation" className="billing-validation-message" role="alert">
                            A remark is required when applying a miscellaneous adjustment.
                        </span>}
                    </label>
                    {quote && <div className="billing-totals">
                        <div className="billing-total-due"><span>Final payable amount</span><strong>₹{finalPayable.toFixed(2)}</strong></div>
                    </div>}
                    {quote && finalPayable === 0
                        ? <p className="billing-waiver-note">No payment is due. A waiver/discount receipt will be generated.</p>
                        : quote && <>
                        <div className="billing-form-grid">
                            <label>Payment method<select required value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPosConfirmed(false); }}>
                                <option value="">Select method</option><option value="CASH">Cash</option><option value="POS">POS</option>
                            </select></label>
                        </div>
                        {paymentMethod === "POS" && <div className="billing-pos-panel">
                            <label className="billing-checkbox"><input type="checkbox" checked={posConfirmed} onChange={(event) => setPosConfirmed(event.target.checked)} /> I manually confirmed receipt of this POS payment.</label>
                        </div>}
                    </>}
                    <div className="billing-form-actions">
                        <button className="billing-primary-button" type="submit" disabled={!quote || quoting || submitting || !miscellaneousAmountValid || (finalPayable > 0 && !paymentMethod) || (paymentMethod === "POS" && !posConfirmed)}>
                            {submitting ? "Saving bill…" : "Create bill"}
                        </button>
                        <button className="billing-secondary-button" type="button" onClick={() => navigate("/billing")}>Cancel</button>
                    </div>
                </section>
            </form>
        </div>
    );
}

export default NewBill;

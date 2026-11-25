import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getDepartments } from "../admin/services/departmentService";
import { getPatientSchemes, registerPatient, updatePatient } from "./services/patientService";
import { registerVisit } from "./services/visitService";
import PatientRegistrationForm from "./PatientRegistrationForm";
import "../styles/PatientRegistration.css";

function toPatientPayload(formData, existingPatient) {
    return {
        firstName: formData.firstName,
        dateOfBirth: formData.dateOfBirth,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone?.trim() || "",
        alternatePhone: formData.alternatePhone || "",
        email: formData.email || "",
        addressLine1: formData.addressLine1 || "",
        city: formData.city || "",
        district: formData.district || "",
        state: formData.state || "",
        postalCode: formData.postalCode || "",
        country: formData.country || "",
        schemeId: formData.schemeId
            ? Number(formData.schemeId)
            : existingPatient
                ? ""
                : undefined,
        schemeAdditionalInformation: formData.schemeAdditionalInformation || [],
    };
}

function NewPatientRegistration() {
    const navigate = useNavigate();
    const submitLock = useRef(false);
    const [schemes, setSchemes] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loadError, setLoadError] = useState("");
    const [serverError, setServerError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pendingPatient, setPendingPatient] = useState(null);

    useEffect(() => {
        let active = true;

        Promise.all([getPatientSchemes(), getDepartments()])
            .then(([schemeResult, departmentResult]) => {
                if (!active) return;
                setSchemes(schemeResult.data || []);
                setDepartments(departmentResult.departments || []);
            })
            .catch((error) => {
                if (active) {
                    setLoadError(
                        error.response?.data?.message ||
                        "Failed to load registration options."
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleRegisterAndPrint = async (formData) => {
        if (submitLock.current) return;

        submitLock.current = true;
        setSaving(true);
        setServerError("");

        try {
            const patientPayload = toPatientPayload(formData, pendingPatient);
            const patientResult = pendingPatient
                ? await updatePatient(pendingPatient.id, patientPayload)
                : await registerPatient(patientPayload);
            const savedPatient = patientResult.data;

            if (!pendingPatient) setPendingPatient(savedPatient);

            const visitResult = await registerVisit({
                patientId: savedPatient.id,
                departmentId: Number(formData.departmentId),
                schemeId: formData.schemeId ? Number(formData.schemeId) : null,
                opFee: Number(formData.opFee),
                paymentMethod: formData.paymentMethod,
                authCode: formData.paymentMethod === "POS" ? formData.authCode : undefined,
                schemeAdditionalInformation: formData.schemeAdditionalInformation || [],
            });

            navigate(`/reception/op-ticket/${visitResult.data.visit.id}`, {
                state: {
                    visit: visitResult.data.visit,
                    tokenNumber: visitResult.data.tokenNumber,
                    tokenLabel: visitResult.data.tokenLabel,
                    autoPrint: true,
                    returnTo: "/reception/patients/new",
                },
            });
        } catch (error) {
            console.error("New patient registration error:", error);
            setServerError(
                error.response?.data?.message ||
                "Registration failed. Please try again."
            );
        } finally {
            submitLock.current = false;
            setSaving(false);
        }
    };

    return (
        <main className="patient-registration-page reception-page">
            <header className="patient-registration-header reception-page-header">
                <h1>New Patient Registration</h1>
            </header>

            {loadError ? (
                <div className="patient-registration-error" role="alert">
                    {loadError}
                </div>
            ) : loading ? (
                <p className="patient-registration-loading">Loading registration options…</p>
            ) : (
                <section className="patient-registration-card">
                    <PatientRegistrationForm
                        key="new-patient-registration"
                        onOpTicket={handleRegisterAndPrint}
                        loading={saving}
                        schemes={schemes}
                        departments={departments}
                        serverError={serverError}
                    />
                </section>
            )}
        </main>
    );
}

export default NewPatientRegistration;

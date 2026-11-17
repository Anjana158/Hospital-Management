import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import PatientDetails from "./PatientDetails";
import {
    getPatientById,
    getPatientSchemes,
} from "./services/patientService";

function RegisteredPatientDetails() {
    const { patientId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        getPatientById(patientId)
            .then((result) => {
                if (active) {
                    setPatient(result.data);
                }
            })
            .catch((loadError) => {
                if (active) {
                    setError(
                        loadError.response?.data?.message ||
                        "Failed to load patient details"
                    );
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        getPatientSchemes()
            .then((result) => {
                if (active) {
                    setSchemes(result.data || []);
                }
            })
            .catch((loadError) => {
                if (active) {
                    setError((current) => current || (
                        loadError.response?.data?.message ||
                        "Failed to load patient schemes"
                    ));
                }
            });

        return () => {
            active = false;
        };
    }, [patientId]);

    if (loading) {
        return <div className="patient-loading">Loading patient details...</div>;
    }

    if (!patient) {
        return (
            <div className="patient-content">
                <div className="patient-error">{error || "Patient details are unavailable."}</div>
                <button
                    type="button"
                    className="action-btn"
                    onClick={() => navigate(location.state?.from || "/reception/registered-patients")}
                >
                    Back to Registered Patients
                </button>
            </div>
        );
    }

    return (
        <div className="patient-content">
            {error && <div className="patient-error">{error}</div>}
            <PatientDetails
                patient={patient}
                schemes={schemes}
                onBack={() => navigate(location.state?.from || "/reception/registered-patients")}
                onAfterUpdate={setPatient}
                onRegisterOp={() => navigate(
                    `/reception/op/${patient.id}`,
                    { state: { returnTo: location.pathname } }
                )}
            />
        </div>
    );
}

export default RegisteredPatientDetails;

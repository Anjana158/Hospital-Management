import { useEffect, useState } from "react";
import {
    FaPlus,
    FaEdit,
    FaUserMd,
} from "react-icons/fa";

import {
    getDoctors,
    createDoctor,
    updateDoctor,
} from "./services/doctorService";

import { getDepartments } from "../admin/services/departmentService";

import "../styles/DepartmentDoctor.css";


function DoctorManagement() {

    const [doctors, setDoctors] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        employeeCode: "",
        fullName: "",
        specialization: "",
        departmentId: "",
        status: "ACTIVE",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    const loadData = async () => {

        try {

            setLoading(true);

            const [
                doctorsData,
                departmentsData,
            ] = await Promise.all([
                getDoctors(),
                getDepartments(),
            ]);

            setDoctors(
                doctorsData.doctors || []
            );

            setDepartments(
                departmentsData.departments || []
            );

        } catch (error) {

            console.error(
                "Load doctor data error:",
                error
            );

            setError(
                error.response?.data?.message ||
                "Failed to load doctors"
            );

        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadData();
    }, []);


    const handleChange = (event) => {

        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    };


    const resetForm = () => {

        setFormData({
            employeeCode: "",
            fullName: "",
            specialization: "",
            departmentId: "",
            status: "ACTIVE",
        });

        setEditingId(null);
        setError("");
    };


    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");
        setSuccess("");


        if (!formData.fullName.trim()) {
            setError("Doctor name is required");
            return;
        }


        if (!formData.departmentId) {
            setError("Please select a department");
            return;
        }


        try {

            setSaving(true);


            const payload = {
                employeeCode:
                    formData.employeeCode.trim(),

                fullName:
                    formData.fullName.trim(),

                specialization:
                    formData.specialization.trim(),

                departmentId:
                    Number(formData.departmentId),

                status:
                    formData.status,
            };


            if (editingId) {

                await updateDoctor(
                    editingId,
                    payload
                );

                setSuccess(
                    "Doctor updated successfully"
                );

            } else {

                await createDoctor(payload);

                setSuccess(
                    "Doctor created successfully"
                );
            }


            resetForm();

            await loadData();

        } catch (error) {

            console.error(
                "Save doctor error:",
                error
            );

            setError(
                error.response?.data?.message ||
                "Failed to save doctor"
            );

        } finally {
            setSaving(false);
        }
    };


    const handleEdit = (doctor) => {

        setEditingId(doctor.id);

        setFormData({
            employeeCode:
                doctor.employeeCode || "",

            fullName:
                doctor.fullName || "",

            specialization:
                doctor.specialization || "",

            departmentId:
                doctor.departmentId
                    ? String(doctor.departmentId)
                    : "",

            status:
                doctor.status || "ACTIVE",
        });

        setError("");
        setSuccess("");

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };


    return (
        <div className="admin-page">

            <div className="admin-page-header">

                <p>MASTER DATA</p>

                <h1>Doctor Management</h1>

                <span>
                    Add doctors and assign them to hospital departments.
                </span>

            </div>


            <div className="management-grid">


                {/* =====================================
                    FORM
                ===================================== */}

                <div className="management-card">

                    <div className="management-card-header">

                        <div className="management-title-icon">
                            <FaUserMd />
                        </div>

                        <div>

                            <h2>
                                {editingId
                                    ? "Edit Doctor"
                                    : "Add Doctor"}
                            </h2>

                            <p>
                                {editingId
                                    ? "Update doctor details"
                                    : "Create a new doctor"}
                            </p>

                        </div>

                    </div>


                    {error && (
                        <div className="form-message error">
                            {error}
                        </div>
                    )}


                    {success && (
                        <div className="form-message success">
                            {success}
                        </div>
                    )}


                    <form onSubmit={handleSubmit}>


                        <div className="form-group">

                            <label>
                                Employee Code
                            </label>

                            <input
                                type="text"
                                name="employeeCode"
                                value={
                                    formData.employeeCode
                                }
                                onChange={handleChange}
                                placeholder="e.g. DOC001"
                                maxLength={30}
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Doctor Name
                            </label>

                            <input
                                type="text"
                                name="fullName"
                                value={
                                    formData.fullName
                                }
                                onChange={handleChange}
                                placeholder="e.g. Dr. Raj Kumar"
                                maxLength={100}
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Specialization
                            </label>

                            <input
                                type="text"
                                name="specialization"
                                value={
                                    formData.specialization
                                }
                                onChange={handleChange}
                                placeholder="e.g. Cardiologist"
                                maxLength={100}
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Department
                            </label>

                            <select
                                name="departmentId"
                                value={
                                    formData.departmentId
                                }
                                onChange={handleChange}
                            >

                                <option value="">
                                    Select Department
                                </option>

                                {departments
                                    .filter(
                                        (department) =>
                                            department.status ===
                                            "ACTIVE"
                                    )
                                    .map(
                                        (department) => (
                                            <option
                                                key={
                                                    department.id
                                                }
                                                value={
                                                    department.id
                                                }
                                            >
                                                {department.name}
                                            </option>
                                        )
                                    )}

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                Status
                            </label>

                            <select
                                name="status"
                                value={
                                    formData.status
                                }
                                onChange={handleChange}
                            >

                                <option value="ACTIVE">
                                    Active
                                </option>

                                <option value="INACTIVE">
                                    Inactive
                                </option>

                            </select>

                        </div>


                        <div className="form-actions">

                            <button
                                type="submit"
                                className="primary-button"
                                disabled={
                                    saving ||
                                    departments.length === 0
                                }
                            >

                                {editingId
                                    ? <FaEdit />
                                    : <FaPlus />
                                }

                                {saving
                                    ? "Saving..."
                                    : editingId
                                        ? "Update Doctor"
                                        : "Add Doctor"
                                }

                            </button>


                            {editingId && (

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={resetForm}
                                >
                                    Cancel
                                </button>

                            )}

                        </div>


                        {departments.length === 0 && (

                            <p className="helper-text">
                                Add at least one active department
                                before creating a doctor.
                            </p>

                        )}

                    </form>

                </div>


                {/* =====================================
                    DOCTOR LIST
                ===================================== */}

                <div className="management-card">

                    <div className="list-header">

                        <div>

                            <h2>
                                Doctors
                            </h2>

                            <p>
                                {doctors.length} doctor
                                {doctors.length !== 1
                                    ? "s"
                                    : ""}
                            </p>

                        </div>

                    </div>


                    {loading ? (

                        <div className="empty-state">
                            Loading doctors...
                        </div>

                    ) : doctors.length === 0 ? (

                        <div className="empty-state">
                            No doctors found.
                        </div>

                    ) : (

                        <div className="management-table-wrapper">

                            <table className="management-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Employee Code
                                        </th>

                                        <th>
                                            Doctor
                                        </th>

                                        <th>
                                            Specialization
                                        </th>

                                        <th>
                                            Department
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

                                    {doctors.map(
                                        (doctor) => (

                                            <tr
                                                key={
                                                    doctor.id
                                                }
                                            >

                                                <td>
                                                    {doctor.employeeCode ||
                                                        "—"}
                                                </td>

                                                <td>
                                                    <strong>
                                                        {
                                                            doctor.fullName
                                                        }
                                                    </strong>
                                                </td>

                                                <td>
                                                    {
                                                        doctor.specialization ||
                                                        "—"
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        doctor
                                                            .department
                                                            ?.name
                                                    }
                                                </td>

                                                <td>

                                                    <span
                                                        className={
                                                            doctor.status ===
                                                            "ACTIVE"
                                                                ? "status-badge active"
                                                                : "status-badge inactive"
                                                        }
                                                    >
                                                        {
                                                            doctor.status
                                                        }
                                                    </span>

                                                </td>

                                                <td>

                                                    <button
                                                        className="icon-button"
                                                        onClick={() =>
                                                            handleEdit(
                                                                doctor
                                                            )
                                                        }
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>

        </div>
    );
}

export default DoctorManagement;
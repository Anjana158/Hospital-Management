import { useEffect, useState } from "react";
import { FaPlus, FaEdit, FaBuilding } from "react-icons/fa";
import {
    getDepartments,
    createDepartment,
    updateDepartment,
} from "./services/departmentService";
import "../styles/DepartmentDoctor.css";

function DepartmentManagement() {
    const [departments, setDepartments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        code: "",
        name: "",
        status: "ACTIVE",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    const loadDepartments = async () => {
        try {
            setLoading(true);
            const data = await getDepartments();
            setDepartments(data.departments || []);
        } catch (error) {
            console.error("Load departments error:", error);
            setError(
                error.response?.data?.message ||
                "Failed to load departments"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
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
            code: "",
            name: "",
            status: "ACTIVE",
        });

        setEditingId(null);
        setError("");
    };


    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");
        if (!formData.code.trim()) {
            setError("Department code is required");
            return;
        }
        if (!formData.name.trim()) {
            setError("Department name is required");
            return;
        }

        try {
            setSaving(true);
            if (editingId) {
                await updateDepartment(editingId,formData);
                setSuccess("Department updated successfully");
            } else {
                await createDepartment(formData);
                setSuccess("Department created successfully")
            }

            resetForm();
            await loadDepartments();

        } catch (error) {
            console.error("Save department error:",error);
            setError(
                error.response?.data?.message ||
                "Failed to save department"
            );

        } finally {
            setSaving(false);
        }
    };


    const handleEdit = (department) => {
        setEditingId(department.id);
        setFormData({
            code: department.code,
            name: department.name,
            status: department.status,
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
                <h1>Department Management</h1>
                <span>Add and manage hospital departments.</span>
            </div>
            <div className="management-grid">
                <div className="management-card">
                    <div className="management-card-header">
                        <div className="management-title-icon">
                            <FaBuilding />
                        </div>
                        <div>
                            <h2>
                                {editingId
                                    ? "Edit Department"
                                    : "Add Department"}
                            </h2>
                            <p>
                                {editingId
                                    ? "Update department details"
                                    : "Create a new hospital department"}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="form-message error">{error}</div>
                    )}

                    {success && (
                        <div className="form-message success">{success}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Department Code</label>
                            <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="e.g. CARD" maxLength={20}/>
                        </div>
                        <div className="form-group">
                            <label>Department Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Cardiology" maxLength={100}/>
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select name="status" value={formData.status} onChange={handleChange}>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="primary-button" disabled={saving}>
                                {editingId ? <FaEdit />: <FaPlus />}
                                {saving
                                    ? "Saving..."
                                    : editingId
                                        ? "Update Department"
                                        : "Add Department"
                                }
                            </button>

                            {editingId && (
                                <button type="button" className="secondary-button" onClick={resetForm} >Cancel </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* =====================================
                    LIST
                ===================================== */}

                <div className="management-card">
                    <div className="list-header">
                        <div>
                            <h2>Departments</h2>
                            <p>
                                {departments.length} department
                                {departments.length !== 1
                                    ? "s"
                                    : ""}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="empty-state">Loading departments...</div>
                    ) : departments.length === 0 ? (
                        <div className="empty-state">No departments found.</div>
                    ) : (
                        <div className="management-table-wrapper">
                            <table className="management-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Department</th>
                                        <th>Doctors</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departments.map(
                                        (department) => (
                                            <tr key={department.id}>
                                                <td><strong>{department.code}</strong></td>
                                                <td>{department.name}</td>
                                                <td>{department._count?.doctors ?? 0}</td>
                                                <td><span
                                                        className={
                                                            department.status ===
                                                            "ACTIVE"
                                                                ? "status-badge active"
                                                                : "status-badge inactive"
                                                        }
                                                    >
                                                        {department.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="icon-button" onClick={() =>handleEdit(department)}title="Edit"><FaEdit /></button>
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

export default DepartmentManagement;
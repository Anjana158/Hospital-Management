import { useEffect, useState } from "react";
import {
    getUsers,
    getRoles,
    createUser,
    updateUser,
    changeUserStatus,
} from "./services/userService";
import "../styles/Users.css";
import { AdminAddButton } from "./AdminTableControls";


function Users() {
    const [users, setUsers] = useState([]);

    const [roles, setRoles] = useState([]);

    const [roleFilter, setRoleFilter] = useState("");

    const [showModal, setShowModal] = useState(false);

    const [editingUser, setEditingUser] = useState(null);

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
            employeeId: "",
            fullName: "",
            username: "",
            password: "",
            roleIds: [],
            status: "ACTIVE",
        });


    // ====================================
    // LOAD USERS
    // ====================================

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError("");

            const result =
                await getUsers(roleFilter);
            setUsers(result.data || []);
        } catch (error) {
            console.error(error);
            setError(error.response?.data?.message ||"Failed to load users");

        } finally {setLoading(false);}
    };

    // ====================================
    // LOAD ROLES
    // ====================================

    const loadRoles = async () => {
        try {
            const result =await getRoles();
            setRoles(result.data || []);
        } catch (error) {
            console.error(error);
            setError("Failed to load roles");
        }
    };

    // ====================================
    // INITIAL LOAD
    // ====================================

    useEffect(() => {
        loadRoles();
    }, []);

    useEffect(() => {
        loadUsers();
    }, [roleFilter]);

    // ====================================
    // INPUT CHANGE
    // ====================================

    const handleChange = (e) => {
        const {name,value,} = e.target;
        setFormData(
            previous => ({

                ...previous,

                [name]: value,

            })
        );
    };


    // ====================================
    // OPEN ADD MODAL
    // ====================================

    const openAddModal = () => {

        setEditingUser(null);

        setFormData({

            employeeId: "",
            fullName: "",
            username: "",
            password: "",
            roleIds: [],
            status: "ACTIVE",

        });

        setError("");

        setShowModal(true);
    };


    // ====================================
    // OPEN EDIT MODAL
    // ====================================

    const openEditModal = (user) => {

        setEditingUser(user);

        setFormData({

            employeeId:
                user.employeeId,

            fullName:
                user.fullName,

            username:
                user.username,

            password: "",

            roleIds:
                (user.roles || []).map((role) => role.id),

            status:
                user.status,

        });

        setError("");

        setShowModal(true);
    };


    // ====================================
    // CLOSE MODAL
    // ====================================

    const closeModal = () => {

        setShowModal(false);

        setEditingUser(null);

        setError("");
    };


    // ====================================
    // SUBMIT FORM
    // ====================================

    const handleSubmit =
        async (e) => {

            e.preventDefault();

            try {

                setError("");

                if (!formData.roleIds.length) {
                    setError("Select at least one role");
                    return;
                }

                if (editingUser) {

                    await updateUser(

                        editingUser.id,

                        formData

                    );

                } else {

                    await createUser(
                        formData
                    );
                }


                closeModal();

                await loadUsers();

            } catch (error) {

                console.error(error);

                setError(

                    error.response?.data?.message ||

                    "Operation failed"

                );
            }
        };


    // ====================================
    // CHANGE STATUS
    // ====================================

    const handleStatusChange =
        async (
            user,
            status
        ) => {

            try {

                await changeUserStatus(
                    user.id,
                    status
                );

                await loadUsers();

            } catch (error) {

                console.error(error);

                setError(

                    error.response?.data?.message ||

                    "Failed to update status"

                );
            }
        };


    return (

        <div className="admin-page">

            {/* ================================
                HEADER
            ================================= */}

            <div className="admin-page-header">
                <h1>
                    Users
                </h1>
            </div>


            {/* ================================
                TOOLBAR
            ================================= */}

            <div className="users-toolbar">

                <div className="user-filter">

                    <label>
                        Filter by Role
                    </label>

                    <select
                        value={roleFilter}
                        onChange={(e) =>
                            setRoleFilter(
                                e.target.value
                            )
                        }
                    >

                        <option value="">
                            All Roles
                        </option>

                        {roles.map(
                            role => (

                                <option
                                    key={role.id}
                                    value={role.id}
                                >
                                    {role.name}
                                </option>

                            )
                        )}

                    </select>

                </div>


                <AdminAddButton type="button" onClick={openAddModal}>
                    Add New User
                </AdminAddButton>

            </div>


            {/* ================================
                ERROR
            ================================= */}

            {error && (

                <div className="users-error">
                    {error}
                </div>

            )}


            {/* ================================
                TABLE
            ================================= */}

            <div className="admin-table-container">

                {loading ? (

                    <div className="admin-empty-state">
                        Loading users...
                    </div>

                ) : users.length === 0 ? (

                    <div className="admin-empty-state">
                        No users found.
                    </div>

                ) : (

                    <table className="admin-data-table admin-users-table">

                        <thead>

                            <tr>

                                <th>
                                    Employee ID
                                </th>

                                <th>
                                    Name
                                </th>

                                <th>
                                    Username
                                </th>

                                <th>
                                    Roles
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Last Login
                                </th>

                                <th>
                                    Actions
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {users.map(
                                user => (

                                    <tr
                                        key={user.id}
                                    >

                                        <td>
                                            {user.employeeId}
                                        </td>

                                        <td>
                                            <strong>
                                                {user.fullName}
                                            </strong>
                                        </td>

                                        <td>
                                            {user.username}
                                        </td>

                                        <td>

                                            <div className="role-badge-list">
                                                {(user.roles || []).map((role) => (
                                                    <span
                                                        key={role.id}
                                                        className="role-badge"
                                                    >
                                                        {role.name}
                                                    </span>
                                                ))}
                                            </div>

                                        </td>

                                        <td>

                                            <select
                                                className={`status-select ${user.status.toLowerCase()}`}
                                                value={
                                                    user.status
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    handleStatusChange(
                                                        user,
                                                        e.target.value
                                                    )
                                                }
                                            >

                                                <option value="ACTIVE">
                                                    ACTIVE
                                                </option>

                                                <option value="INACTIVE">
                                                    INACTIVE
                                                </option>

                                                <option value="LOCKED">
                                                    LOCKED
                                                </option>

                                            </select>

                                        </td>

                                        <td>

                                            {user.lastLogin
                                                ? new Date(
                                                    user.lastLogin
                                                ).toLocaleString()
                                                : "Never"}

                                        </td>

                                        <td>

                                            <button
                                                className="admin-row-action-button"
                                                onClick={() =>
                                                    openEditModal(
                                                        user
                                                    )
                                                }
                                            >
                                                Edit
                                            </button>

                                        </td>

                                    </tr>

                                )
                            )}

                        </tbody>

                    </table>

                )}

            </div>


            {/* ================================
                MODAL
            ================================= */}

            {showModal && (

                <div
                    className="user-modal-overlay"
                    onClick={closeModal}
                >

                    <div
                        className="user-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="user-modal-title"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div className="user-modal-header">

                            <div>

                                <h2 id="user-modal-title">
                                    {editingUser
                                        ? "Edit User"
                                        : "Add New User"}
                                </h2>

                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Close"
                                onClick={closeModal}
                            >
                                ×
                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleSubmit
                            }
                        >

                            <div className="form-grid">

                                <div className="form-group">

                                    <label>
                                        Employee ID
                                    </label>

                                    <input
                                        type="text"
                                        name="employeeId"
                                        value={
                                            formData.employeeId
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    />

                                </div>


                                <div className="form-group">

                                    <label>
                                        Full Name
                                    </label>

                                    <input
                                        type="text"
                                        name="fullName"
                                        value={
                                            formData.fullName
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    />

                                </div>


                                <div className="form-group">

                                    <label>
                                        Username
                                    </label>

                                    <input
                                        type="text"
                                        name="username"
                                        value={
                                            formData.username
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    />

                                </div>


                                <div className="form-group">

                                    <label>
                                        Password
                                    </label>

                                    <input
                                        type="password"
                                        name="password"
                                        value={
                                            formData.password
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required={
                                            !editingUser
                                        }
                                        placeholder={
                                            editingUser
                                                ? "Leave blank to keep current password"
                                                : ""
                                        }
                                    />

                                </div>


                                <div className="form-group roles-field">

                                    <label>
                                        Roles
                                    </label>

                                    <div className="role-checkbox-list">
                                        {roles.map((role) => (
                                            <label
                                                key={role.id}
                                                className="role-checkbox-item"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.roleIds.includes(role.id)}
                                                    onChange={() => {
                                                        setFormData((previous) => {
                                                            const selected = previous.roleIds.includes(role.id);
                                                            return {
                                                                ...previous,
                                                                roleIds: selected
                                                                    ? previous.roleIds.filter((id) => id !== role.id)
                                                                    : [...previous.roleIds, role.id],
                                                            };
                                                        });
                                                    }}
                                                />
                                                <span>{role.name}</span>
                                            </label>
                                        ))}
                                    </div>

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
                                        onChange={
                                            handleChange
                                        }
                                    >

                                        <option value="ACTIVE">
                                            ACTIVE
                                        </option>

                                        <option value="INACTIVE">
                                            INACTIVE
                                        </option>

                                        <option value="LOCKED">
                                            LOCKED
                                        </option>

                                    </select>

                                </div>

                            </div>


                            {error && (

                                <div className="modal-error">
                                    {error}
                                </div>

                            )}


                            <div className="modal-actions">

                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={
                                        closeModal
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="save-user-btn"
                                >
                                    {editingUser
                                        ? "Update User"
                                        : "Create User"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </div>
    );
}

export default Users;
import { useEffect, useState } from "react";

import {
    getUsers,
    getRoles,
    createUser,
    updateUser,
    changeUserStatus,
} from "./services/userService";

import "../styles/Users.css";


function Users() {

    const [users, setUsers] =
        useState([]);

    const [roles, setRoles] =
        useState([]);

    const [roleFilter, setRoleFilter] =
        useState("");

    const [showModal, setShowModal] =
        useState(false);

    const [editingUser, setEditingUser] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [formData, setFormData] =
        useState({

            employeeId: "",
            fullName: "",
            username: "",
            password: "",
            roleId: "",
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
                await getUsers(
                    roleFilter
                );

            setUsers(
                result.data || []
            );

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.message ||
                "Failed to load users"
            );

        } finally {

            setLoading(false);

        }
    };


    // ====================================
    // LOAD ROLES
    // ====================================

    const loadRoles = async () => {

        try {

            const result =
                await getRoles();

            setRoles(
                result.data || []
            );

        } catch (error) {

            console.error(error);

            setError(
                "Failed to load roles"
            );
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

        const {
            name,
            value,
        } = e.target;


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
            roleId: "",
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

            roleId:
                user.role.id,

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

                <p>
                    ADMINISTRATION
                </p>

                <h1>
                    Users
                </h1>

                <span>
                    Manage hospital system users.
                </span>

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


                <button
                    className="add-user-btn"
                    onClick={openAddModal}
                >

                    <span>
                        +
                    </span>

                    Add New User

                </button>

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

            <div className="users-table-container">

                {loading ? (

                    <div className="users-loading">
                        Loading users...
                    </div>

                ) : users.length === 0 ? (

                    <div className="users-empty">
                        No users found.
                    </div>

                ) : (

                    <table className="users-table">

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
                                    Role
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

                                            <span className="role-badge">
                                                {user.role.name}
                                            </span>

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
                                                className="edit-user-btn"
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
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div className="user-modal-header">

                            <div>

                                <p>
                                    ADMINISTRATION
                                </p>

                                <h2>
                                    {editingUser
                                        ? "Edit User"
                                        : "Add New User"}
                                </h2>

                            </div>

                            <button
                                className="modal-close"
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


                                <div className="form-group">

                                    <label>
                                        Role
                                    </label>

                                    <select
                                        name="roleId"
                                        value={
                                            formData.roleId
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    >

                                        <option value="">
                                            Select Role
                                        </option>

                                        {roles.map(
                                            role => (

                                                <option
                                                    key={
                                                        role.id
                                                    }
                                                    value={
                                                        role.id
                                                    }
                                                >
                                                    {
                                                        role.name
                                                    }
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
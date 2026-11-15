 import {
     FaHospital,
     FaUserPlus,
 } from "react-icons/fa";

import {
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";

import "../styles/StaffDashboard.css";
import { logout } from "../auth/session";


function ReceptionDashboard() {

    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === "/reception";
    const isPatientManagement = location.pathname.startsWith("/reception/patients");
    const isReportsPage = location.pathname.startsWith("/reception/reports");

    const user =
        JSON.parse(
            localStorage.getItem("user")
        );

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };


    return (

        <div className="staff-dashboard">

            {/* ================= NAVBAR ================= */}

            <header className="staff-navbar">

                <div className="staff-navbar-brand">

                    <FaHospital
                        className="staff-hospital-icon"
                    />

                    <div>

                        <h2>
                            Hospital Management System
                        </h2>

                        <span>
                            Reception Portal
                        </span>

                    </div>

                </div>


                <div className="staff-navbar-user">

                    <div className="staff-user-info">

                        <strong>
                            {user?.username ||
                                "Reception Staff"}
                        </strong>

                        <span>
                            {user?.role?.name ||
                                "RECEPTION"}
                        </span>

                    </div>

                </div>

            </header>


            {/* ================= BODY ================= */}

            <div className="staff-body">

                {/* SIDEBAR */}

                <aside className="staff-sidebar">

                    <nav className="staff-navigation">

                        <button
                            className={`staff-nav-link${isDashboard ? " active" : ""}`}
                            onClick={() =>
                                navigate("/reception")
                            }
                        >
                            <span>▣</span>
                            <span>Dashboard</span>
                        </button>

                        <button
                            className={`staff-nav-link${isPatientManagement ? " active" : ""}`}
                            onClick={() => navigate("/reception/patients")}
                        >
                            <FaUserPlus />
                            <span>New Patient</span>
                        </button>

                        <button
                            className={`staff-nav-link${isReportsPage ? " active" : ""}`}
                            onClick={() => navigate("/reception/reports")}
                        >
                            <span>▤</span>
                            <span>Reports</span>
                        </button>

                    </nav>


                    <div className="staff-sidebar-bottom">

                        <button
                            className="staff-logout"
                            onClick={handleLogout}
                        >
                            <span>↪</span>
                            <span>Logout</span>
                        </button>

                    </div>

                </aside>


                {/* CONTENT */}

                <main className="staff-content">

                    <Outlet />

                </main>

            </div>

        </div>
    );
}

export default ReceptionDashboard;
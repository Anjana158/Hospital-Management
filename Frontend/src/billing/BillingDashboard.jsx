import {
    FaHospital,
} from "react-icons/fa";

import {
    Outlet,
    useNavigate,
    useLocation,
} from "react-router-dom";

import "../styles/StaffDashboard.css";
import { logout } from "../auth/session";


function BillingDashboard() {

    const navigate = useNavigate();
    const location = useLocation();

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

            {/* NAVBAR */}

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
                            Billing Portal
                        </span>

                    </div>

                </div>


                <div className="staff-navbar-user">

                    <div className="staff-user-info">

                        <strong>
                            {user?.username ||
                                "Billing Staff"}
                        </strong>

                        <span>
                            {user?.role?.name ||
                                "BILLING"}
                        </span>

                    </div>

                </div>

            </header>


            <div className="staff-body">

                {/* SIDEBAR */}

                <aside className="staff-sidebar">

                    <nav className="staff-navigation">

                        <button
                            className={`staff-nav-link ${location.pathname === "/billing" ? "active" : ""}`}
                            onClick={() =>
                                navigate("/billing")
                            }
                        >
                            <span>▣</span>
                            <span>Dashboard</span>
                        </button>


                        <button
                            className={`staff-nav-link ${location.pathname.startsWith("/billing/new") ? "active" : ""}`}
                            onClick={() => navigate("/billing/new")}
                        >
                            <span>₹</span>
                            <span>New Bill</span>
                        </button>

                        <button
                            className={`staff-nav-link ${location.pathname.startsWith("/billing/reports") ? "active" : ""}`}
                            onClick={() => navigate("/billing/reports")}
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


                <main className="staff-content">

                    <Outlet />

                </main>

            </div>

        </div>
    );
}

export default BillingDashboard;
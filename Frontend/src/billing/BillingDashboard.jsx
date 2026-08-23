import {
    FaHospital,
    FaUserCircle,
} from "react-icons/fa";

import {
    Outlet,
    useNavigate,
} from "react-router-dom";

import "../styles/StaffDashboard.css";


function BillingDashboard() {

    const navigate = useNavigate();

    const user =
        JSON.parse(
            localStorage.getItem("user")
        );


    const handleLogout = () => {

        localStorage.removeItem("token");
        localStorage.removeItem("user");

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
                            {user?.fullName ||
                                "Billing Staff"}
                        </strong>

                        <span>
                            {user?.role?.name ||
                                "BILLING"}
                        </span>

                    </div>

                    <FaUserCircle
                        className="staff-user-icon"
                    />

                </div>

            </header>


            <div className="staff-body">

                {/* SIDEBAR */}

                <aside className="staff-sidebar">

                    <nav className="staff-navigation">

                        <button
                            className="staff-nav-link active"
                            onClick={() =>
                                navigate("/billing")
                            }
                        >
                            <span>▣</span>
                            <span>Dashboard</span>
                        </button>


                        <button
                            className="staff-nav-link"
                            onClick={() =>
                                alert(
                                    "Billing will be added next."
                                )
                            }
                        >
                            <span>₹</span>
                            <span>New Bill</span>
                        </button>


                        <button
                            className="staff-nav-link"
                            onClick={() =>
                                alert(
                                    "Payment search will be added next."
                                )
                            }
                        >
                            <span>⌕</span>
                            <span>Find Bill</span>
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
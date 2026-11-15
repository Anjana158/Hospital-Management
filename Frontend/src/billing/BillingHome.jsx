import {
    FaFileInvoiceDollar,
    FaChartBar,
    FaClock,
} from "react-icons/fa";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


function BillingHome() {

    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        const loadDashboard = async () => {

            try {

                const token =
                    localStorage.getItem("token");

                const response =
                    await fetch(
                        "/api/dashboard/me",
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Failed to load dashboard"
                    );
                }


                setUser(data.data);

            } catch (error) {

                console.error(
                    "Dashboard error:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };


        loadDashboard();

    }, []);


    if (loading) {
        return (
            <div className="staff-loading">
                Loading dashboard...
            </div>
        );
    }


    return (

        <div className="staff-home">

            <div className="staff-page-header">

                <p>
                    BILLING DASHBOARD
                </p>

                <h1>
                    Welcome, {user?.fullName}
                </h1>

                <span>
                    Manage billing, payments and
                    patient invoices efficiently.
                </span>

            </div>


            {/* QUICK ACTIONS */}

            <div className="staff-action-grid">

                <div className="staff-action-card" role="button" tabIndex={0}
                    onClick={() => navigate("/billing/new")}
                    onKeyDown={(event) => event.key === "Enter" && navigate("/billing/new")}>

                    <div className="staff-action-icon">
                        <FaFileInvoiceDollar />
                    </div>

                    <div>
                        <strong>
                            New Bill
                        </strong>

                        <span>
                            Create a patient bill
                        </span>
                    </div>

                </div>


                <div className="staff-action-card" role="button" tabIndex={0}
                    onClick={() => navigate("/billing/reports")}
                    onKeyDown={(event) => event.key === "Enter" && navigate("/billing/reports")}>

                    <div className="staff-action-icon">
                        <FaChartBar />
                    </div>

                    <div>
                        <strong>
                            Reports
                        </strong>

                        <span>
                            Review billing and collection totals
                        </span>
                    </div>

                </div>
            </div>


            {/* ACCOUNT */}

            <div className="staff-section">

                <div className="staff-section-header">

                    <div>
                        <p>
                            ACCOUNT INFORMATION
                        </p>

                        <h2>
                            My Account
                        </h2>
                    </div>

                </div>


                <div className="staff-info-grid">

                    <div className="staff-info-item">
                        <span>Employee ID</span>

                        <strong>
                            {user?.employeeId}
                        </strong>
                    </div>


                    <div className="staff-info-item">
                        <span>Username</span>

                        <strong>
                            {user?.username}
                        </strong>
                    </div>


                    <div className="staff-info-item">
                        <span>Role</span>

                        <strong>
                            {user?.role?.name}
                        </strong>
                    </div>


                    <div className="staff-info-item">
                        <span>Status</span>

                        <strong className="staff-status">
                            {user?.status}
                        </strong>
                    </div>

                </div>

            </div>


            {/* ACTIVITY */}

            <div className="staff-section">

                <div className="staff-section-header">

                    <div>

                        <p>
                            MY ACTIVITY
                        </p>

                        <h2>
                            Recent Activity
                        </h2>

                    </div>

                </div>


                <div className="staff-activity">

                    <div className="staff-activity-icon">
                        <FaClock />
                    </div>


                    <div>

                        <strong>
                            Last Login
                        </strong>

                        <span>
                            {user?.lastLogin
                                ? new Date(
                                    user.lastLogin
                                ).toLocaleString()
                                : "First login"}
                        </span>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default BillingHome;
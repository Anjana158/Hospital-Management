import {
  FaUsers,
  FaUserShield,
  FaHospitalUser,
} from "react-icons/fa";

function DashboardHome() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="dashboard-home">
      <div className="admin-page-header">
        <div>
          <h1>Welcome, {user?.fullName || "System Administrator"}</h1>
        </div>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <FaUsers />
          </div>
          <div>
            <span>Total Users</span>
            <strong>5</strong>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <FaUserShield />
          </div>
          <div>
            <span>Total Roles</span>
            <strong>3</strong>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <FaHospitalUser />
          </div>
          <div>
            <span>Active Users</span>
            <strong>5</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
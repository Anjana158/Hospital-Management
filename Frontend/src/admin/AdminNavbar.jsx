import { FaHospital, FaUserCircle } from "react-icons/fa";

function AdminNavbar() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <header className="admin-navbar">

      <div className="navbar-brand">
        <FaHospital className="navbar-hospital-icon" />

        <div>
          <h2>Hospital Management System</h2>
          <span>Administration Portal</span>
        </div>
      </div>

      <div className="navbar-user">

        <div className="navbar-user-info">
          <strong>
            {user?.fullName || "Administrator"}
          </strong>

          <span>
            {user?.role?.name || "ADMIN"}
          </span>
        </div>

        <FaUserCircle className="navbar-user-icon" />

      </div>

    </header>
  );
}

export default AdminNavbar;
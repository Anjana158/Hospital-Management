import {
  FaTachometerAlt,
  FaUsers,
  FaTags,
  FaBuilding,
  FaChartBar,
  FaSignOutAlt,
} from "react-icons/fa";

import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../auth/session";

function AdminSidebar() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside className="admin-sidebar">
      <nav className="sidebar-navigation">
        <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <FaTachometerAlt />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/dashboard/users" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <FaUsers />
          <span>Users</span>
        </NavLink>

        <NavLink to="/dashboard/schemes" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <FaTags />
          <span>Schemes</span>
        </NavLink>

        <NavLink to="/dashboard/departments" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <FaBuilding />
          <span>Departments</span>
        </NavLink>

        <NavLink to="/dashboard/reports" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <FaChartBar />
          <span>Reports</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-logout" onClick={handleLogout}>
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
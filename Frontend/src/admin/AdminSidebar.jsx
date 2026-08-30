import {
  FaTachometerAlt,
  FaUsers,
  FaTags,
  FaSignOutAlt,
} from "react-icons/fa";

import { NavLink, useNavigate } from "react-router-dom";

function AdminSidebar() {

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  return (
    <aside className="admin-sidebar">

      <nav className="sidebar-navigation">

        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <FaTachometerAlt />

          <span>Dashboard</span>
        </NavLink>


        <NavLink 
          to="/dashboard/users"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <FaUsers />

          <span>Users</span>
        </NavLink>

        <NavLink
          to="/dashboard/patient-categories"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <FaTags />

          <span>Patient Categories</span>
        </NavLink>

      </nav>


      <div className="sidebar-bottom">

        <button
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt />

          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
}

export default AdminSidebar;
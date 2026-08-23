import { Outlet } from "react-router-dom";

import AdminNavbar from "./AdminNavbar";
import AdminSidebar from "./AdminSidebar";

import "../styles/AdminDashboard.css";

function AdminDashboard() {
  return (
    <div className="admin-dashboard">

      <AdminNavbar />

      <div className="admin-body">

        <AdminSidebar />

        <main className="admin-content">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default AdminDashboard;
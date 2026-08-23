import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute({ allowedRoles }) {

  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (!token || !storedUser) {
    return <Navigate to="/" replace />;
  }

  let user;
  try{
    user = JSON.parse(storedUser);
  } catch{
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    return <Navigate to="/" replace />;
  }

  const userRole = user?.role?.name?.toUpperCase();
  const roles = allowedRoles.map(role => role.toUpperCase());

  if(!roles.includes(userRole)){
    if(userRole === "ADMIN"){
      return <Navigate to="/dashboard" replace />;
    }
    if(userRole === "RECEPTION"){
      return <Navigate to="/reception" replace />;
    }
    if(userRole === "BILLING"){
      return <Navigate to="/billing" replace />;
    }

    return <Navigate to="/" replace />;
    
  }

  return <Outlet />;
}

export default ProtectedRoute;
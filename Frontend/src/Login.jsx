import "./styles/login.css";
import { useEffect, useRef, useState } from "react";
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaIdBadge,
} from "react-icons/fa";


import hospitalImage from "./assets/ThrissurDistrictHospital.jpg";
import { useNavigate } from "react-router-dom";
import { saveAccessToken } from "./auth/session";

function Login() {
  const navigate = useNavigate();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const isAdminAccount = assignedRoles.some(
    (role) => role.name.toUpperCase() === "ADMIN"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const roleRequestId = useRef(0);

  useEffect(() => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setAssignedRoles([]);
      setSelectedRole("");
      setRolesLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++roleRequestId.current;

      try {
        setRolesLoading(true);

        const response = await fetch(
          `/api/auth/roles?username=${encodeURIComponent(trimmedUsername)}`
        );
        const data = await response.json();

        if (requestId !== roleRequestId.current) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to load roles");
        }

        const roles = data.data || [];
        setAssignedRoles(roles);
        setSelectedRole((current) => {
          if (roles.some((role) => role.name === current)) {
            return current;
          }
          return roles.length === 1 ? roles[0].name : "";
        });
      } catch (loadError) {
        if (requestId !== roleRequestId.current) {
          return;
        }
        setAssignedRoles([]);
        setSelectedRole("");
        setError(loadError.message);
      } finally {
        if (requestId === roleRequestId.current) {
          setRolesLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (
      !username ||
      !password ||
      (!selectedRole && !isAdminAccount && assignedRoles.length > 0)
    ) {
      setError("Please enter username, password and select a role.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
            role: isAdminAccount ? undefined : selectedRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      saveAccessToken(data.data.token);

      // Save logged-in user
      localStorage.setItem(
        "user",
        JSON.stringify(data.data.user)
      );

      console.log("Login successful:", data);

      const role = data.data.user.role?.name?.toUpperCase();

      if(role === "ADMIN"){
        navigate("/dashboard");
      }
      else if(role === "RECEPTION"){
        navigate("/reception");
      }
      else if(role === "BILLING"){
        navigate("/billing");
      }
      else{
        setError("Your account does not have a valid role");
      }

      

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url(${hospitalImage})`,
      }}
    >

      {/* Background light overlay */}
      <div className="background-overlay"></div>

      {/* Right side pastel background */}
      <div className="right-background"></div>

      {/* Decorative shapes */}
      <div className="decorative-top"></div>
      <div className="decorative-bottom"></div>

      <div className="login-container">

        {/* ================= LEFT CONTENT ================= */}

        <section className="welcome-section">

          <div className="welcome-content">

            <p className="welcome-small">
              Welcome to
            </p>

            <h1 className="hospital-title">
              Hospital
            </h1>

            <h2 className="management-title">
              Management System
            </h2>

            <div className="pink-line"></div>

            <p className="welcome-description">
              A unified platform for managing hospital operations,
              <br />
              patient care and administrative tasks efficiently.
            </p>

          </div>

        </section>


        {/* ================= RIGHT LOGIN SECTION ================= */}

        <section className="login-section">

          <div className="login-card">

            <h2 className="login-heading">
              Welcome <span>Back!</span>
            </h2>

            <p className="login-subtitle">
              Login to your account to continue
            </p>


            <form onSubmit={handleLogin}>

              {/* USERNAME */}

              <div className="input-wrapper">

                <FaUser className="input-icon" />

                <input
                  type="text"
                  placeholder="User ID"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setAssignedRoles([]);
                    setSelectedRole("");
                    setError("");
                  }}
                  autoComplete="username"
                />

              </div>


              {/* PASSWORD */}

              <div className="input-wrapper">

                <FaLock className="input-icon" />

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                </button>

              </div>


              {!isAdminAccount && (
                <div className="input-wrapper">
                  <FaIdBadge className="input-icon" />

                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      setError("");
                    }}
                    disabled={rolesLoading || assignedRoles.length === 0}
                  >
                    <option value="">
                      {rolesLoading
                        ? "Loading roles..."
                        : username.trim()
                          ? "Select Role"
                          : "Enter username to load roles"}
                    </option>

                    {assignedRoles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}


              {/* ERROR */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}


              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >

                {loading ? (
                  <span className="loading-text">
                    Logging in...
                  </span>
                ) : (
                  <>
                    <FaArrowRight className="arrow-icon" />
                    <span>Login</span>
                  </>
                )}

              </button>

            </form>

          </div>

        </section>

      </div>

    </div>
  );
}

export default Login;
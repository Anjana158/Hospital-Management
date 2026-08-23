import "./styles/login.css";
import { useState } from "react";
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
} from "react-icons/fa";


import hospitalImage from "./assets/ThrissurDistrictHospital.jpg";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Save JWT token
      localStorage.setItem("token", data.data.token);

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
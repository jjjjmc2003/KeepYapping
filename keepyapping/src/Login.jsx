import { Link, useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user arrived here after email verification
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes('verified')) {
      setMessage("Email verified successfully! You can now log in.");
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Login failed. Please check your credentials and/or verify your account.");
        return;
      }

      const { user } = data;

      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking user table:", selectError);
        setError("An error occurred while checking your profile.");
        return;
      }

      if (!existingUser) {
        await supabase.from("users").insert([
          {
            email: user.email,
            name: "",
            bio: "",
            displayname: "",
          },
        ]);
      }

      setError("");
      // The onAuthStateChange listener in App.jsx will handle setting the user
      if (onLogin) onLogin(user);
      navigate("/");
    } catch (error) {
      setError(`Unexpected error: ${error.message}`);
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Inter', sans-serif",
        backgroundColor: "#111",
        backgroundImage: `url(${backgroundImage})`,
        backgroundRepeat: "repeat",
        backgroundSize: "230px 230px",
        backgroundPosition: "center",
      }}
    >
      {/* Login Card */}
      <div
        className="auth-card"
        style={{
         backgroundColor: "rgba(20, 20, 20, 0.92)",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(6px)",
          width: "320px",
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "fadeIn 0.5s ease-in-out",
          zIndex: 1,
        }}
      >
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff" }}>Welcome to KeepYapping</h2>
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>Log in to your account</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && (
            <div
              className="error-message"
              style={{
                backgroundColor: "#ff4d4d",
                color: "#fff",
                padding: "0.75rem",
                borderRadius: "6px",
                marginBottom: "1rem",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="success-message"
              style={{
                backgroundColor: "#4CAF50",
                color: "#fff",
                padding: "0.75rem",
                borderRadius: "6px",
                marginBottom: "1rem",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="email" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                backgroundColor: "#1e1e1e",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: "8px",
                padding: "0.75rem",
                fontSize: "1rem",
                marginTop: "0.25rem",
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  backgroundColor: "#1e1e1e",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  marginTop: "0.25rem",
                  paddingRight: "2.5rem", // Make room for the eye icon
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#5865f2", // KeepYapping blue color
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "0.25rem",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="1em" height="1em" fill="currentColor">
                    <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c5.2-11.8 8-24.8 8-38.5c0-53-43-96-96-96c-2.8 0-5.6 .1-8.4 .4c5.3 9.3 8.4 20.1 8.4 31.6c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zm223.1 298L373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="1em" height="1em" fill="currentColor">
                    <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            className="auth-button"
            type="submit"
            style={{
              backgroundColor: "#6366f1",
              color: "white",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              padding: "0.75rem",
              fontSize: "1rem",
              cursor: "pointer",
              width: "100%",
              transition: "background-color 0.3s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#4f46e5")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#6366f1")}
          >
            Log In
          </button>
        </form>

        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
          <p style={{ color: "#aaa", marginBottom: "0.5rem" }}>
            <Link to="/password-reset" style={{ color: "#6366f1", textDecoration: "none" }}>
              Forgot Password?
            </Link>
          </p>
          <p style={{ color: "#aaa" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color: "#6366f1", textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}

export default Login;

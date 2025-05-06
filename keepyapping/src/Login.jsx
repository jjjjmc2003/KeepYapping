import { Link, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
            <input
              id="password"
              type="password"
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
              }}
            />
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

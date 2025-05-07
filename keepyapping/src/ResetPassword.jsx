import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // The ResetPasswordWrapper component has already verified the token
  // and signed out any existing user, so we can assume we're in a valid recovery flow

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      console.log("Attempting to update password");

      // Get the current session to check if we're in a recovery flow
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Current session:", sessionData);

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      console.log("Password update result, error:", updateError);

      if (updateError) {
        setError(`Error updating password: ${updateError.message}`);
      } else {
        setMessage("Your password has been updated successfully!");

        // Sign out the user to ensure a clean state
        await supabase.auth.signOut();

        // Redirect to login page after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (err) {
      console.error("Error in password update:", err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
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
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff" }}>Set New Password</h2>
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>
            Create a new password for your account
          </p>
        </div>

        <form className="auth-form" onSubmit={handlePasswordUpdate}>
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
              <label htmlFor="password" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter new password"
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

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="confirmPassword" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              disabled={loading}
              style={{
                backgroundColor: loading ? "#4a4a4a" : "#6366f1",
                color: "white",
                fontWeight: "600",
                border: "none",
                borderRadius: "8px",
                padding: "0.75rem",
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                width: "100%",
                transition: "background-color 0.3s",
              }}
              onMouseOver={(e) => !loading && (e.target.style.backgroundColor = "#4f46e5")}
              onMouseOut={(e) => !loading && (e.target.style.backgroundColor = "#6366f1")}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
          <p style={{ color: "#aaa" }}>
            Remember your password?{" "}
            <Link to="/login" style={{ color: "#6366f1", textDecoration: "none" }}>
              Log in
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

export default ResetPassword;

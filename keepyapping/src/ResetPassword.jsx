import { Link, useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for recovery mode from multiple sources
  useEffect(() => {
    console.log("Location state:", location.state);

    // First check if we were redirected from AuthRedirect component
    if (location.state && location.state.recovery === true) {
      console.log('Recovery mode from redirect detected');
      setIsRecoveryMode(true);
      return;
    }

    // Check URL parameters for recovery token
    const checkUrlForRecoveryToken = () => {
      const url = new URL(window.location.href);
      const type = url.searchParams.get('type');
      const token = url.searchParams.get('token');

      // If URL contains recovery parameters, we're in recovery mode
      if (type === 'recovery' && token) {
        console.log('Recovery token detected in URL');
        setIsRecoveryMode(true);
        return true;
      }
      return false;
    };

    // Check URL for recovery token
    const hasRecoveryToken = checkUrlForRecoveryToken();

    // If no token in URL, listen for auth state changes
    if (!hasRecoveryToken) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state change event:', event);
        if (event === "PASSWORD_RECOVERY") {
          console.log('PASSWORD_RECOVERY event detected');
          setIsRecoveryMode(true);
        }
      });

      // Also check if we're already in a recovery state via session
      const checkRecoveryState = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Active session detected');
          setIsRecoveryMode(true);
        }
      };

      checkRecoveryState();

      // Cleanup subscription on unmount
      return () => {
        if (authListener && authListener.subscription) {
          authListener.subscription.unsubscribe();
        }
      };
    }
  }, [location]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    // Validate passwords
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Password has been updated successfully!");

        // Clear the form
        setPassword("");
        setConfirmPassword("");

        // Redirect to login page after a delay
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setIsLoading(false);
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
      {/* Reset Password Card */}
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
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>Create a new password for your account</p>
        </div>

        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            backgroundColor: "#333",
            color: "#fff",
            padding: "0.5rem",
            borderRadius: "4px",
            fontSize: "0.8rem",
            marginBottom: "1rem",
            wordBreak: "break-all"
          }}>
            <p><strong>Debug Info:</strong></p>
            <p>Recovery Mode: {isRecoveryMode ? "Yes" : "No"}</p>
            <p>URL: {window.location.href}</p>
            <p>Location State: {JSON.stringify(location.state)}</p>
          </div>
        )}

        {!isRecoveryMode ? (
          <div
            style={{
              backgroundColor: "#ff4d4d",
              color: "#fff",
              padding: "0.75rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            Invalid or expired password reset link. Please request a new password reset.
            <div style={{ marginTop: "1rem" }}>
              <Link
                to="/forgot-password"
                style={{
                  backgroundColor: "#fff",
                  color: "#ff4d4d",
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                  textDecoration: "none",
                  fontWeight: "600",
                }}
              >
                Request New Link
              </Link>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleResetPassword}>
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
              disabled={isLoading}
              style={{
                backgroundColor: "#6366f1",
                color: "white",
                fontWeight: "600",
                border: "none",
                borderRadius: "8px",
                padding: "0.75rem",
                fontSize: "1rem",
                cursor: isLoading ? "not-allowed" : "pointer",
                width: "100%",
                transition: "background-color 0.3s",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseOver={(e) => !isLoading && (e.target.style.backgroundColor = "#4f46e5")}
              onMouseOut={(e) => !isLoading && (e.target.style.backgroundColor = "#6366f1")}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

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

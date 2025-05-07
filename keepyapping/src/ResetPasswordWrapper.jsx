import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ResetPassword from "./ResetPassword";

function ResetPasswordWrapper() {
  const [loading, setLoading] = useState(true);
  const [isValidResetLink, setIsValidResetLink] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // This function runs when the component mounts
    console.log("ResetPasswordWrapper mounted");
    console.log("Current URL hash:", location.hash);

    const checkResetToken = async () => {
      try {
        console.log("Current URL:", window.location.href);
        console.log("Current hash:", location.hash);

        // The RouteHandler component has already signed out the user and verified the token
        // We can just show the reset password form
        setIsValidResetLink(true);
        setLoading(false);
      } catch (err) {
        console.error("Error in ResetPasswordWrapper:", err);
        setError("An unexpected error occurred. Please try again.");
        setTimeout(() => {
          navigate('/password-reset');
        }, 3000);
        setLoading(false);
      }
    };

    checkResetToken();
  }, [location, navigate]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#111",
        color: "white",
        fontFamily: "'Inter', sans-serif"
      }}>
        Loading...
      </div>
    );
  }

  if (!isValidResetLink) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#111",
        color: "white",
        fontFamily: "'Inter', sans-serif",
        flexDirection: "column",
        textAlign: "center",
        padding: "0 20px"
      }}>
        <div style={{
          backgroundColor: "rgba(20, 20, 20, 0.92)",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
          maxWidth: "400px"
        }}>
          <h2 style={{ marginBottom: "1rem" }}>Password Reset Error</h2>
          <p style={{ marginBottom: "1rem" }}>{error}</p>
          <p>Redirecting to password reset request page...</p>
        </div>
      </div>
    );
  }

  return <ResetPassword />;
}

export default ResetPasswordWrapper;

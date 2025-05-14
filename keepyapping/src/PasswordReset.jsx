/**
 * PasswordReset.jsx
 *
 * This component provides a password reset functionality for the KeepYapping application.
 * It allows users to request a password reset email by entering their registered email address.
 * The component verifies if the email exists in the database before sending the reset link.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

// Supabase connection configuration
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Initialize Supabase client
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * PasswordReset component that handles the password reset request process
 *The password reset form UI
 * @returns {JSX.Element} 
 */
function PasswordReset() {
  // State variables to manage form data and UI states
  // User's email input
  const [email, setEmail] = useState("");       
    // Error message to display
  const [error, setError] = useState("");  
  // Success message to display   
  const [message, setMessage] = useState("");   
  // Loading state for the submit button
  const [loading, setLoading] = useState(false); 

  /**
   * Handles the password reset request form submission
   *
   * This function:
   * 1. Validates the email input
   * 2. Checks if the email exists in the database
   * 3. Sends a password reset email via Supabase
   * 4. Displays appropriate success/error messages
   * - The form submission event
   * @param {Event} e 
   */
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    // Reset previous messages
    setError("");
    setMessage("");
    setLoading(true);

    // Basic validation
    if (!email) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    try {
      console.log("Checking if email exists:", email);

      // First check if the email exists in the users table
      // This is an important security feature to prevent email enumeration
      const { data: existingUser, error: userCheckError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .single();

      // Handle database query errors ignore "not found" errors
      if (userCheckError && userCheckError.code !== "PGRST116") {
        console.error("Error checking if email exists:", userCheckError);
      }

      // If no user found with this email, show specific error message
      if (!existingUser) {
        setError("Not a valid email");
        setLoading(false);
        return;
      }

      console.log("Email exists, sending password reset email to:", email);

      // Use Supabase's built-in password reset functionality
      // The redirectTo parameter specifies where users will be directed after clicking the reset link
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://keep-yapping.netlify.app/reset-password#for-password-reset`,
      });

      console.log("Password reset email sent, error:", resetError);

      // Handle the response from the password reset request
      if (resetError) {
        setError(`Error: ${resetError.message}`);
      } else {
        // Show success message when email is sent successfully
        setMessage(
          "Password reset instructions have been sent to your email. Please check your inbox."
        );
      }
    } catch (err) {
      // Catch any unexpected errors
      setError(`Unexpected error: ${err.message}`);
    } finally {
      // Always reset loading state when operation completes
      setLoading(false);
    }
  };

  /**
   * Render the password reset form with styled UI elements
   */
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
        // Background with KeepYapping logo pattern
        backgroundImage: `url(${backgroundImage})`, 
        backgroundRepeat: "repeat",
        backgroundSize: "230px 230px",
        backgroundPosition: "center",
      }}
    >
      {/* Main card container with glass-like effect */}
      <div
        className="auth-card"
        style={{
          backgroundColor: "rgba(20, 20, 20, 0.92)",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
          // Creates glass effect
          backdropFilter: "blur(6px)", 
          width: "320px",
          maxHeight: "90vh",
          overflowY: "auto",
          // Fade-in animation
          animation: "fadeIn 0.5s ease-in-out", 
          zIndex: 1,
        }}
      >
        {/* Header section with title and instructions */}
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff" }}>Reset Password</h2>
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>
            Enter your email to receive reset instructions
          </p>
        </div>

        {/* Password reset form */}
        <form className="auth-form" onSubmit={handlePasswordReset}>
          {/* Error message display - only shown when there's an error */}
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

          {/* Success message display - only shown after successful submission */}
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

          {/* Email input field */}
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

          {/* Submit button with loading state */}
          <button
            className="auth-button"
            type="submit"
            disabled={loading}
            style={{
              // Different color when loading
              backgroundColor: loading ? "#4a4a4a" : "#6366f1", 
              color: "white",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              padding: "0.75rem",
              fontSize: "1rem",
              // Change cursor when loading
              cursor: loading ? "not-allowed" : "pointer", 
              width: "100%",
              // Smooth color transition
              transition: "background-color 0.3s", 
            }}
            // Hover effects for better user feedback
            onMouseOver={(e) => !loading && (e.target.style.backgroundColor = "#4f46e5")}
            onMouseOut={(e) => !loading && (e.target.style.backgroundColor = "#6366f1")}
          >
            {loading ? "Sending..." : "Send Reset Instructions"}
          </button>
        </form>

        {/* Footer with link back to login page */}
        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
          <p style={{ color: "#aaa" }}>
            Remember your password?{" "}
            <Link to="/login" style={{ color: "#6366f1", textDecoration: "none" }}>
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Animation keyframes for the fade-in effect */}
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

// Export the component for use in other parts of the application
export default PasswordReset;

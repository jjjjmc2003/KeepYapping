import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

// Supabase connection configuration
// These are the credentials for connecting to our Supabase backend
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Initialize the Supabase client for authentication and database operations
// This client will be used throughout the component for auth operations
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ResetPassword component handles the password reset functionality
 * It allows users to set a new password after receiving a password reset link via email
 * The component processes URL tokens from Supabase's password reset flow
 * and provides a form for users to enter and confirm their new password
 */
function ResetPassword() {
  // State variables for form inputs and UI control
  // Stores the new password input
  const [password, setPassword] = useState(""); 
  // Stores the confirmation password for validation
  const [confirmPassword, setConfirmPassword] = useState(""); 
  // Holds error messages to display to the user
  const [error, setError] = useState(""); 
  // Holds success messages to display to the user
  const [message, setMessage] = useState(""); 
  // Tracks when form submission is in progress
  const [loading, setLoading] = useState(false);
  // Controls password field visibility toggle 
  const [showPassword, setShowPassword] = useState(false); 
  // Controls confirm password field visibility toggle
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 
  // Hook for programmatic navigation between routes
  const navigate = useNavigate();

  /**
   * Check if we have a valid hash in the URL when component mounts
   * This is needed for password reset flow where Supabase sends a URL with tokens
   * The function extracts authentication tokens from the URL and establishes a session
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Get the hash fragment from the URL contains the auth tokens
        const hash = window.location.hash;
        console.log("Reset password hash:", hash);

        // Log the raw hash content for debugging purposes
        if (hash) {
          let hashContent = hash.substring(1);
          console.log("Raw hash content:", hashContent);

          // Handle special case where hash contains another hash symbol
          // Supabase sometimes adds prefixes like #for-password-reset# before the actual tokens
          if (hashContent.includes('#')) {
            console.log("Contains special prefix, extracting actual parameters");
            console.log("After prefix removal:", hashContent.split('#')[1]);
          }
        }

        // If there's a hash with access token, process it to set up the session
        if (hash && (hash.includes('access_token=') || hash.includes('#access_token='))) {
          // The hash contains the access token and refresh token from Supabase
          // We need to manually set the session using these parameters
          console.log("Found access token in URL, setting session");

          // Extract the hash content without the leading # character
          let hashContent = hash.substring(1);

          // Handle special case where Supabase adds a prefix like #for-password-reset#
          if (hashContent.includes('#')) {
            // Split at the second # to get the actual auth parameters
            hashContent = hashContent.split('#')[1];
          }

          // Parse the URL parameters into an object
          // This converts the URL hash string into a usable JavaScript object
          const hashParams = hashContent.split('&').reduce((params, param) => {
            const [key, value] = param.split('=');
            params[key] = value;
            return params;
          }, {});

          console.log("Hash parameters:", hashParams);

          // If we have an access token, set up the session with Supabase
          if (hashParams.access_token) {
            // Set the session manually using the extracted tokens
            // This establishes an authenticated session with Supabase
            const { error } = await supabase.auth.setSession({
              access_token: hashParams.access_token,
              refresh_token: hashParams.refresh_token || ''
            });

            if (error) {
              console.error("Error setting session:", error);
              setError("Error setting up password reset session. Please request a new reset link.");
            } else {
              console.log("Session set successfully");
            }
          }
        } else {
          console.log("No access token found in URL");
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };

    // Run the session check when component mounts
    checkSession();
  }, []);

  /**
   * Handle the password update form submission
   * Validates passwords, checks for valid session, and updates the user's password
   * This function is called when the user submits the password reset form
   * - The form submission event
   * @param {Event} e 
   */
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    // Reset any previous messages to provide a clean slate for new feedback
    setError("");
    setMessage("");
    setLoading(true);

    // Validate password inputs before proceeding with the update
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

      // Check if we already have a valid session from the useEffect
      // This verifies if the user is authenticated before allowing password change
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Current session:", sessionData);

      // If no session exists, try to extract tokens from URL again
      // This is a fallback in case the initial session setup in useEffect failed
      if (!sessionData.session) {
        console.log("No session found, trying to extract token from URL");

        // Get the hash from the URL which contains authentication tokens
        const hash = window.location.hash;

        if (hash && (hash.includes('access_token=') || hash.includes('#access_token='))) {
          // Extract the hash without the # character and handle special prefix
          let hashContent = hash.substring(1);

          // Check if there's a special prefix like #for-password-reset#
          // Supabase sometimes adds these prefixes to the URL
          if (hashContent.includes('#')) {
            // Split at the second # to get the actual parameters
            hashContent = hashContent.split('#')[1];
          }

          // Parse URL parameters, using decodeURIComponent to handle special characters
          // This converts encoded URL characters back to their original form
          const hashParams = hashContent.split('&').reduce((params, param) => {
            const [key, value] = param.split('=');
            params[key] = decodeURIComponent(value);
            return params;
          }, {});

          console.log("Hash parameters:", hashParams);

          // Try to establish a session with the extracted tokens
          if (hashParams.access_token) {
            // Set the session manually with Supabase using the extracted tokens
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: hashParams.access_token,
              refresh_token: hashParams.refresh_token || ''
            });

            if (sessionError) {
              console.error("Error setting session:", sessionError);
              setError("Error setting up password reset session. Please request a new reset link.");
              setLoading(false);
              return;
            }

            console.log("Session set successfully");
          } else {
            setError("Invalid reset link. Please request a new one.");
            setLoading(false);
            return;
          }
        } else {
          setError("Invalid reset link. Please request a new one.");
          setLoading(false);
          return;
        }
      }

      // Now that we have a valid session, update the user's password
      // This uses Supabase's updateUser method to change the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      console.log("Password update result, error:", updateError);

      if (updateError) {
        setError(`Error updating password: ${updateError.message}`);
      } else {
        // Show success message to confirm the password was updated
        setMessage("Your password has been updated successfully!");

        // Sign out the user to ensure a clean state after password reset
        // This forces the user to log in with their new password
        await supabase.auth.signOut();

        // Redirect to login page after a short delay
        // This gives the user time to read the success message
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (err) {
      console.error("Error in password update:", err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      // Always reset loading state regardless of success or failure
      setLoading(false);
    }
  };

  // Render the password reset form UI
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
      {/* Main card container for the password reset form */}
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
        {/* Header section with title and description */}
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff" }}>Set New Password</h2>
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>
            Create a new password for your account
          </p>
        </div>

        {/* Password reset form with validation and submission handling */}
        <form className="auth-form" onSubmit={handlePasswordUpdate}>
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

            {/* Success message display - only shown after successful password update */}
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

            {/* New password input field with visibility toggle */}
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="password" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
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
                    paddingRight: "2.5rem" // Make room for the eye icon
                  }}
                />
                {/* Password visibility toggle button */}
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
                    // KeepYapping blue color
                    color: "#5865f2", 
                    // Increased size
                    fontSize: "1.5rem", 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "0.25rem",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {/* SVG icon for hidden/visible password state */}
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="1.2em" height="1.2em" fill="currentColor">
                      <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c5.2-11.8 8-24.8 8-38.5c0-53-43-96-96-96c-2.8 0-5.6 .1-8.4 .4c5.3 9.3 8.4 20.1 8.4 31.6c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zm223.1 298L373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="1.2em" height="1.2em" fill="currentColor">
                      <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm password input field with visibility toggle */}
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="confirmPassword" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
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
                    // Make room for the eye icon
                    paddingRight: "2.5rem" 
                  }}
                />
                {/* Confirm password visibility toggle button */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                     // KeepYapping blue color
                    color: "#5865f2",
                     // Increased size
                    fontSize: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "0.25rem",
                  }}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {/* SVG icon for hidden/visible confirm password state */}
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="1.2em" height="1.2em" fill="currentColor">
                      <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c5.2-11.8 8-24.8 8-38.5c0-53-43-96-96-96c-2.8 0-5.6 .1-8.4 .4c5.3 9.3 8.4 20.1 8.4 31.6c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zm223.1 298L373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="1.2em" height="1.2em" fill="currentColor">
                      <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button for the password update form */}
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

      {/* Animation keyframes for fade-in effect when component loads */}
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
export default ResetPassword;

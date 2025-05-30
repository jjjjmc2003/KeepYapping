import React, { useState } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";

const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Signup component
 *
 * This component handles user registration for the KeepYapping application.
 * It collects user information, validates inputs, creates an account in Supabase Auth,
 * and stores additional user profile information in the database.
 *
 * The component includes form validation, duplicate email/username checking,
 * and password visibility toggles for better user experience.
 */
function Signup() {
  // State variables for form inputs
  // User's full name
  const [name, setName] = useState(""); 
  // User's biography/description
  const [bio, setBio] = useState(""); 
  // User's email address used for authentication
  const [email, setEmail] = useState(""); 
  // User's display name username
  const [displayname, setDisplayname] = useState(""); 
  // User's password
  const [password, setPassword] = useState(""); 
  // Password confirmation
  const [confirmPassword, setConfirmPassword] = useState(""); 

  // State variables for UI feedback
  // Error messages to display
  const [error, setError] = useState(""); 
  // Success messages to display
  const [message, setMessage] = useState(""); 

  // State variables for password visibility toggles
  // Toggle for password field
  const [showPassword, setShowPassword] = useState(false); 
  // Toggle for confirm password field
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 

  // Hook for programmatic navigation between routes
  const navigate = useNavigate();

  /**
   * Handle the signup form submission
   * This function processes the user registration, including validation and database operations
   * - The form submission event
   * @param {Event} e 
   */
  const handleSignup = async (e) => {
    e.preventDefault();
    // Reset any previous feedback messages
    setError("");
    setMessage("");

    // Validate that all required fields are filled
    if (!name || !bio || !email || !displayname || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    // Validate that passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      // Check if the email is already in use
      // This prevents duplicate accounts with the same email
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .single();

      // Handle database query errors PGRST116 is "no rows returned" which is expected
      if (emailCheckError && emailCheckError.code !== "PGRST116") {
        setError(`Error checking email: ${emailCheckError.message}`);
        return;
      }

      // If email already exists, show error and stop registration
      if (existingEmail) {
        setError("This email is already associated with an account.");
        return;
      }

      // Check if the display name is already taken
      // This ensures unique usernames across the platform
      const { data: existingDisplayname, error: displaynameCheckError } =
        await supabase
          .from("users")
          .select("displayname")
          .eq("displayname", displayname)
          .single();

      // Handle database query errors
      if (displaynameCheckError && displaynameCheckError.code !== "PGRST116") {
        setError(`Error checking display name: ${displaynameCheckError.message}`);
        return;
      }

      // If display name already exists, show error and stop registration
      if (existingDisplayname) {
        setError("This display name is already taken.");
        return;
      }

      console.log("Signing up user with email:", email);

      // Create the user account in Supabase Auth
      // This handles the authentication part of the registration
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Redirect URL for email confirmation
          // After confirming email, user will be redirected to login page
          emailRedirectTo: 'https://keep-yapping.netlify.app/login#verified'
        }
      });

      console.log("Sign up result, error:", signUpError);

      // Handle signup errors from Supabase Auth
      if (signUpError) {
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }

      // Store additional user information in the users table
      // This includes profile data not stored in the auth system
      const { error: insertError } = await supabase.from("users").insert([
        {
          email,
          name,
          bio,
          displayname,
        },
      ]);

      // Handle database insertion errors
      if (insertError) {
        setError(`Failed to save user info: ${insertError.message}`);
        return;
      }

      // Show success message to the user
      setMessage("Account has been created! Please check your email to confirm your account.");

      // Redirect to login page after a short delay
      // This gives the user time to read the success message
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      // Catch any unexpected errors during the registration process
      setError(`Unexpected error: ${err.message}`);
    }
  };

  /**
   * Render the signup form UI
   */
  return (
    <div
      className="auth-container"
      style={{
        height: "100vh",
        backgroundColor: "#111",
        backgroundImage: `url(${backgroundImage})`,
        backgroundRepeat: "repeat",
        backgroundSize: "230px 230px",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Main card container for the signup form */}
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
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#fff" }}>Create an Account</h2>
          <p style={{ color: "#ccc" }}>Join KeepYapping today</p>
        </div>

        {/* Signup form with validation and submission handling */}
        <form className="auth-form" onSubmit={handleSignup}>

          {/* Full Name input field */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="name" style={{ color: "#ccc" }}>Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              style={inputStyle}
            />
          </div>

          {/* Display Name input field - this is the username shown to other users */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="displayname" style={{ color: "#ccc" }}>Display Name</label>
            <input
              id="displayname"
              type="text"
              value={displayname}
              onChange={(e) => setDisplayname(e.target.value)}
              placeholder="Choose a display name"
              required
              style={inputStyle}
            />
          </div>

          {/* Email input field - used for authentication and account recovery */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="email" style={{ color: "#ccc" }}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={inputStyle}
            />
          </div>

          {/* Bio textarea - allows users to provide a short description about themselves */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="bio" style={{ color: "#ccc" }}>Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              required
              style={{ ...inputStyle, height: "80px", resize: "none" }}
            />
          </div>

          {/* Password input field with visibility toggle */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" style={{ color: "#ccc" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                style={{
                  ...inputStyle,
                  // Make room for the eye icon
                  paddingRight: "2.5rem" 
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
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {/* SVG icons for password visibility state */}
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

          {/* Confirm Password input field with visibility toggle */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="confirmPassword" style={{ color: "#ccc" }}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                style={{
                  ...inputStyle,
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
                }}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {/* SVG icons for confirm password visibility state */}
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

          {/* Submit button for the signup form */}
          <button
            className="auth-button"
            type="submit"
            style={{
              backgroundColor: "#6366f1",
              color: "#fff",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontWeight: "600",
              fontSize: "1rem",
              width: "100%",
              cursor: "pointer",
              marginBottom: "0.75rem"
            }}
          >
            Sign Up
          </button>

          {/* Error message display - only shown when there's an error */}
          {error && (
            <div style={{
              color: "white",
              backgroundColor: "#f04747",
              padding: "0.75rem",
              borderRadius: "8px",
              marginTop: "0.5rem",
              fontSize: "0.9rem",
              textAlign: "center"
            }}>
              {error}
            </div>
          )}

          {/* Success message display - only shown after successful signup */}
          {message && (
            <div style={{
              color: "white",
              backgroundColor: "#43b581",
              padding: "0.75rem",
              borderRadius: "8px",
              marginTop: "0.5rem",
              fontSize: "0.9rem",
              textAlign: "center"
            }}>
              {message}
            </div>
          )}
        </form>

        {/* Footer with link to login page */}
        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem" }}>
          <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
            Already have an account?{" "}
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

/**
 * Common input field styling
 * This object defines the shared styles for all input fields in the form
 * Extracted to avoid repetition and maintain consistency
 */
const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  backgroundColor: "#1e1e1e",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "8px",
  fontSize: "1rem",
};

// Export the component for use in the application's routing
export default Signup;

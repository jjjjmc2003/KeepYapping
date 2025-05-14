// Import React Router components for navigation and getting URL information
import { Link, useNavigate, useLocation } from "react-router-dom";
// Import React and hooks for creating components and managing state
import React, { useState, useEffect } from "react";
// Import Supabase client for authentication and database operations
import * as SupabaseClient from "@supabase/supabase-js";
// Import CSS styles for the authentication pages
import "../styles/Auth.css";
// Import the app logo to use as background
import backgroundImage from "./Images/KeepYappingLogo.png";

// Connection details for our Supabase database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
// This is the public API key (safe to include in frontend code)
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Create a Supabase client we can use throughout the component
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login component - handles user authentication
// Takes an onLogin callback function that will be called when login is successful
function Login({ onLogin }) {
  // State for form inputs and UI control
  const [email, setEmail] = useState("");           // User's email address
  const [password, setPassword] = useState("");     // User's password
  const [error, setError] = useState("");           // Error message to display
  const [message, setMessage] = useState("");       // Success message to display
  const [showPassword, setShowPassword] = useState(false); // Toggle for password visibility

  // Hooks for navigation and getting URL information
  const navigate = useNavigate();  // Used to redirect after login
  const location = useLocation();  // Used to check URL parameters

  // This effect checks if the user arrived at the login page after verifying their email
  // When a user clicks the verification link in their email, they get redirected here with a special URL hash
  useEffect(() => {
    // Get the hash part of the URL (the part after the # symbol)
    const hash = location.hash;

    // If the hash contains 'verified', it means they just verified their email
    if (hash && hash.includes('verified')) {
      // Show a success message to let them know verification worked
      setMessage("Email verified successfully! You can now log in.");
    }
  }, [location]); // Re-run this effect if the location changes

  // Function that handles the login form submission
  const handleLogin = async (e) => {
    // Prevent the default form submission behavior (page reload)
    e.preventDefault();
    // Clear any previous error messages
    setError("");

    try {
      // Step 1: Attempt to sign in with Supabase authentication
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,     // Email from the form input
        password,  // Password from the form input
      });

      // If login failed, show an error message
      if (signInError) {
        setError("Login failed. Please check your credentials and/or verify your account.");
        return; // Stop execution if login failed
      }

      // Get the user object from the successful login
      const { user } = data;

      // Step 2: Check if the user already has a profile in our users table
      // This is separate from authentication - it stores additional user info
      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("*")           // Get all columns
        .eq("email", email)    // Where email matches the login email
        .single();             // We expect only one result

      // Handle database errors (except "not found" which is PGRST116)
      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking user table:", selectError);
        setError("An error occurred while checking your profile.");
        return; // Stop execution if there was a database error
      }

      // Step 3: If the user doesn't have a profile yet, create one
      // This happens for first-time logins
      if (!existingUser) {
        await supabase.from("users").insert([
          {
            email: user.email,  // Use the email from authentication
            name: "",           // Start with empty name
            bio: "",            // Start with empty bio
            displayname: "",    // Start with empty display name
          },
        ]);
      }

      // Step 4: Complete the login process
      setError(""); // Clear any errors (redundant but safe)

      // Call the onLogin callback passed from the parent component
      // This typically updates the app's state to reflect the logged-in user
      if (onLogin) onLogin(user);

      // Redirect to the home page
      navigate("/");
    } catch (error) {
      // Handle any unexpected errors
      setError(`Unexpected error: ${error.message}`);
    }
  };

  // Render the login form UI
  return (
    // Main container that takes up the full viewport height
    <div
      className="auth-container"
      style={{
        height: "100vh",                    // Full viewport height
        display: "flex",                    // Use flexbox for centering
        justifyContent: "center",           // Center horizontally
        alignItems: "center",               // Center vertically
        fontFamily: "'Inter', sans-serif",  // Modern sans-serif font
        backgroundColor: "#111",            // Dark background
        backgroundImage: `url(${backgroundImage})`, // App logo background
        backgroundRepeat: "repeat",         // Repeat the logo pattern
        backgroundSize: "230px 230px",      // Size of each logo
        backgroundPosition: "center",       // Center the pattern
      }}
    >
      {/* Login card - the main form container */}
      <div
        className="auth-card"
        style={{
          backgroundColor: "rgba(20, 20, 20, 0.92)", // Semi-transparent dark background
          borderRadius: "12px",                      // Rounded corners
          padding: "1.5rem",                         // Inner spacing
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)", // Drop shadow
          backdropFilter: "blur(6px)",               // Blur effect for background
          width: "320px",                            // Fixed width
          maxHeight: "90vh",                         // Maximum height
          overflowY: "auto",                         // Scroll if content is too tall
          animation: "fadeIn 0.5s ease-in-out",      // Fade-in animation
          zIndex: 1,                                 // Layer order
        }}
      >
        {/* Header with app name and subtitle */}
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff" }}>Welcome to KeepYapping</h2>
          <p style={{ color: "#ccc", fontSize: "0.95rem" }}>Log in to your account</p>
        </div>

        {/* Login form - calls handleLogin when submitted */}
        <form className="auth-form" onSubmit={handleLogin}>
          {/* Error message - only shown if there's an error */}
          {error && (
            <div
              className="error-message"
              style={{
                backgroundColor: "#ff4d4d",    // Red background
                color: "#fff",                 // White text
                padding: "0.75rem",            // Inner spacing
                borderRadius: "6px",           // Rounded corners
                marginBottom: "1rem",          // Bottom margin
                textAlign: "center",           // Center text
              }}
            >
              {error}
            </div>
          )}

          {/* Success message - only shown if there's a message (like after email verification) */}
          {message && (
            <div
              className="success-message"
              style={{
                backgroundColor: "#4CAF50",    // Green background
                color: "#fff",                 // White text
                padding: "0.75rem",            // Inner spacing
                borderRadius: "6px",           // Rounded corners
                marginBottom: "1rem",          // Bottom margin
                textAlign: "center",           // Center text
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
              type="email"                         // Email input type for validation
              placeholder="Enter your email"       // Placeholder text
              value={email}                        // Controlled input value
              onChange={(e) => setEmail(e.target.value)} // Update state when typing
              required                             // HTML5 validation
              style={{
                width: "100%",                     // Full width
                backgroundColor: "#1e1e1e",        // Dark input background
                color: "#fff",                     // White text
                border: "1px solid #444",          // Dark border
                borderRadius: "8px",               // Rounded corners
                padding: "0.75rem",                // Inner spacing
                fontSize: "1rem",                  // Text size
                marginTop: "0.25rem",              // Space after label
              }}
            />
          </div>

          {/* Password input field */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" style={{ color: "#bbb", fontSize: "0.9rem", fontWeight: "500" }}>
              Password
            </label>
            <div style={{ position: "relative" }}> {/* Container for password input and toggle button */}
              <input
                id="password"
                type={showPassword ? "text" : "password"} // Toggle between text and password type
                placeholder="Enter your password"         // Placeholder text
                value={password}                          // Controlled input value
                onChange={(e) => setPassword(e.target.value)} // Update state when typing
                required                                  // HTML5 validation
                style={{
                  width: "100%",                          // Full width
                  backgroundColor: "#1e1e1e",             // Dark input background
                  color: "#fff",                          // White text
                  border: "1px solid #444",               // Dark border
                  borderRadius: "8px",                    // Rounded corners
                  padding: "0.75rem",                     // Inner spacing
                  fontSize: "1rem",                       // Text size
                  marginTop: "0.25rem",                   // Space after label
                  paddingRight: "2.5rem"                  // Make room for the eye icon
                }}
              />
              {/* Show/hide password toggle button */}
              <button
                type="button"                             // Button type (not submit)
                onClick={() => setShowPassword(!showPassword)} // Toggle password visibility
                style={{
                  position: "absolute",                   // Position over the input
                  right: "10px",                          // Distance from right
                  top: "50%",                             // Center vertically
                  transform: "translateY(-50%)",          // Adjust for perfect centering
                  background: "none",                     // No background
                  border: "none",                         // No border
                  cursor: "pointer",                      // Show pointer on hover
                  color: "#5865f2",                       // KeepYapping blue color
                  fontSize: "1.5rem",                     // Icon size
                  display: "flex",                        // Flexbox for centering
                  alignItems: "center",                   // Center vertically
                  justifyContent: "center",               // Center horizontally
                  marginTop: "0.25rem",                   // Adjust position
                }}
                aria-label={showPassword ? "Hide password" : "Show password"} // Accessibility label
              >
                {/* Eye-slash icon when password is visible */}
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="1.2em" height="1.2em" fill="currentColor">
                    <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c5.2-11.8 8-24.8 8-38.5c0-53-43-96-96-96c-2.8 0-5.6 .1-8.4 .4c5.3 9.3 8.4 20.1 8.4 31.6c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zm223.1 298L373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5z"/>
                  </svg>
                ) : (
                  // Eye icon when password is hidden
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="1.2em" height="1.2em" fill="currentColor">
                    <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            className="auth-button"
            type="submit"                              // Submit the form when clicked
            style={{
              backgroundColor: "#6366f1",              // Purple button
              color: "white",                          // White text
              fontWeight: "600",                       // Semi-bold text
              border: "none",                          // No border
              borderRadius: "8px",                     // Rounded corners
              padding: "0.75rem",                      // Inner spacing
              fontSize: "1rem",                        // Text size
              cursor: "pointer",                       // Show pointer on hover
              width: "100%",                           // Full width
              transition: "background-color 0.3s",     // Smooth color transition
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#4f46e5")} // Darker on hover
            onMouseOut={(e) => (e.target.style.backgroundColor = "#6366f1")}  // Normal when not hovering
          >
            Log In
          </button>
        </form>

        {/* Footer with links to other auth pages */}
        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
          {/* Forgot password link */}
          <p style={{ color: "#aaa", marginBottom: "0.5rem" }}>
            <Link to="/password-reset" style={{ color: "#6366f1", textDecoration: "none" }}>
              Forgot Password?
            </Link>
          </p>
          {/* Sign up link */}
          <p style={{ color: "#aaa" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color: "#6366f1", textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* CSS animation for the fade-in effect */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); } /* Start small and invisible */
            to { opacity: 1; transform: scale(1); }      /* End at full size and visible */
          }
        `}
      </style>
    </div>
  );
}

export default Login;

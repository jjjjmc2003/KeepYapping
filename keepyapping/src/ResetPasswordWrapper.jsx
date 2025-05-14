import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ResetPassword from "./ResetPassword";

// This file serves as a wrapper component for the password reset functionality
// It validates the reset token in the URL before rendering the actual reset form
// If the token is invalid or missing, it redirects to the password reset request page

/**
 * ResetPasswordWrapper component
 *
 * This component acts as a security layer for the password reset process.
 * It validates that the URL contains proper reset tokens before allowing
 * the user to access the actual password reset form.
 *
 * The component checks for various token formats that might be present in the URL,
 * as Supabase can send different types of reset links depending on configuration.
 */
function ResetPasswordWrapper() {
  // State to track if the component is still checking the token
  const [loading, setLoading] = useState(true);

  // State to track if the reset link is valid
  const [isValidResetLink, setIsValidResetLink] = useState(false);

  // State to store error messages if the reset link is invalid
  const [error, setError] = useState("");

  // Get the current location object to access URL parameters and hash
  const location = useLocation();

  // Get the navigate function to redirect users if needed
  const navigate = useNavigate();

  /**
   * Effect hook to validate the reset token when the component mounts
   * or when the location/navigate dependencies change
   */
  useEffect(() => {
    // Log component initialization for debugging
    console.log("ResetPasswordWrapper mounted");
    console.log("Current URL hash:", location.hash);

    /**
     * Checks if the URL contains valid reset token parameters
     * Supabase can include tokens in either the hash or search params
     * depending on the authentication flow configuration
     */
    const checkResetToken = async () => {
      try {
        // Log the full URL and hash for debugging purposes
        console.log("Current URL:", window.location.href);
        console.log("Current hash:", location.hash);

        // Check if we have a token in the URL hash fragment
        // Supabase often includes tokens after the # symbol
        const hash = location.hash;
        const hasToken = hash && (
          // Check for different possible token formats
          // Standard recovery type
          hash.includes('type=recovery') || 
          // OAuth style token
          hash.includes('access_token=') || 
           // Custom prefix
          hash.includes('for-password-reset')
        );

        // Also check if the URL contains any parameters in the query string
        // Some configurations might include tokens as regular URL parameters
        const search = location.search;
        const hasParams = search && (
          // Direct token parameter
          search.includes('token=') ||
          // Recovery type in query params 
          search.includes('type=recovery') 
        );

        // If we found valid token indicators in either location
        if (hasToken || hasParams) {
          console.log("Valid reset token found, showing reset form");
          setIsValidResetLink(true);
        } else {
          // No valid token found, show error and redirect
          console.log("No valid reset token found");
          setError("Invalid or missing recovery token. Please request a new password reset link.");

          // Redirect after a short delay to allow the user to read the error
          setTimeout(() => {
            navigate('/password-reset');
          }, 3000);
        }

        // Update loading state to show appropriate UI
        setLoading(false);
      } catch (err) {
        // Handle any unexpected errors during token validation
        console.error("Error in ResetPasswordWrapper:", err);
        setError("An unexpected error occurred. Please try again.");

        // Redirect to password reset request page after error
        setTimeout(() => {
          navigate('/password-reset');
        }, 3000);

        // Update loading state to show error UI
        setLoading(false);
      }
    };

    // Execute the token validation function
    checkResetToken();
  }, [location, navigate]);

  /**
   * Loading state UI
   * Displayed while the component is checking the reset token
   */
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

  /**
   * Error state UI
   * Displayed when the reset link is invalid or missing required tokens
   * Shows an error message and informs the user they're being redirected
   */
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

  /**
   * Success state - render the actual password reset form
   * Only shown when a valid reset token is found in the URL
   */
  return <ResetPassword />;
}

// Export the component for use in the application's routing
export default ResetPasswordWrapper;

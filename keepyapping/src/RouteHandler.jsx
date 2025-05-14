import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';

/**
 * RouteHandler component
 *
 * This component handles special routes that need to override the normal authentication flow.
 * It acts as a middleware layer in the routing system to intercept certain routes
 * and apply custom logic before deciding whether to render the requested component
 * or redirect the user to a different page.
 *
 * Currently, it specifically handles the password reset flow by checking for valid
 * reset tokens in the URL before allowing access to the reset password page.
 */
function RouteHandler({ children }) {
  // State to track if the route analysis is still in progress
  const [loading, setLoading] = useState(true);

  // State to determine if we need to redirect the user
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // State to store the path to redirect to if needed
  const [redirectPath, setRedirectPath] = useState('');

  // Get the current location object to access URL information
  const location = useLocation();

  /**
   * Effect hook that runs whenever the location changes
   * This analyzes the current route and determines if special handling is needed
   */
  useEffect(() => {
    /**
     * Handles special routes that need custom logic
     * Currently focuses on the password reset flow validation
     */
    const handleSpecialRoutes = async () => {
      try {
        // Extract relevant parts of the current URL
        const pathname = location.pathname;
        const hash = location.hash;

        // Log detailed URL information for debugging purposes
        console.log('RouteHandler - Current URL:', window.location.href);
        console.log('RouteHandler - Current path:', pathname);
        console.log('RouteHandler - Current hash:', hash);
        console.log('RouteHandler - Current search params:', location.search);

        // Special handling for the reset password page
        if (pathname === '/reset-password') {
          console.log('RouteHandler - On reset password page');

          // Check if we have a token in the URL hash
          // We need to be very permissive here to catch all possible token formats
          // Supabase can send tokens in various formats depending on configuration
          const hasToken = hash && (
            // Standard recovery type
            hash.includes('type=recovery') ||     
            // OAuth style token
            hash.includes('access_token=') || 
            // Custom prefix    
            hash.includes('for-password-reset') || 
            // Direct token parameter
            hash.includes('token=')              
          );

          // Also check if the URL contains any parameters in the query string
          // Some configurations might include tokens as regular URL parameters
          const hasParams = location.search && (
            // Direct token parameter
            location.search.includes('token=') ||  
            // Recovery type in query params   
            location.search.includes('type=recovery') 
          );

          // If we found valid token indicators in either location
          if (hasToken || hasParams) {
            console.log('RouteHandler - Found reset token or params');

            // We don't want to sign out the user here anymore
            // We need to keep the token in the URL for the ResetPassword component to use

            // Let the normal routing continue - allow access to reset password page
            setShouldRedirect(false);
          } else {
            // No valid token found, redirect to the password reset request page
            console.log('RouteHandler - No reset token or params found, redirecting to password reset request page');
            setRedirectPath('/password-reset');
            setShouldRedirect(true);
          }
        } else {
          // For all other routes, let normal routing continue without interference
          setShouldRedirect(false);
        }
      } catch (error) {
        // Log any errors that occur during route handling
        console.error('RouteHandler - Error:', error);

        // In case of error, let normal routing continue as a fallback
        setShouldRedirect(false);
      } finally {
        // Update loading state to show appropriate UI
        setLoading(false);
      }
    };

    // Execute the route handling function
    handleSpecialRoutes();
  }, [location]);

  /**
   * Loading state UI
   * Displayed while the component is analyzing the route
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
   * Redirect state
   * If the route analysis determined a redirect is needed,
   * use React Router's Navigate component to redirect the user
   */
  if (shouldRedirect) {
    return <Navigate to={redirectPath} replace />;
  }

  /**
   * Default state - render the children
   * This allows the normal routing to continue when no special handling is needed
   */
  return children;
}

// Export the component for use in the application's routing system
export default RouteHandler;

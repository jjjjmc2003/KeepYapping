import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import * as SupabaseClient from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * This component handles special routes that need to override the normal authentication flow
 */
function RouteHandler({ children }) {
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectPath, setRedirectPath] = useState('');
  const location = useLocation();

  useEffect(() => {
    const handleSpecialRoutes = async () => {
      try {
        const pathname = location.pathname;
        const hash = location.hash;

        console.log('RouteHandler - Current URL:', window.location.href);
        console.log('RouteHandler - Current path:', pathname);
        console.log('RouteHandler - Current hash:', hash);
        console.log('RouteHandler - Current search params:', location.search);

        // Check if we're on the reset password page
        if (pathname === '/reset-password') {
          console.log('RouteHandler - On reset password page');

          // Check if we have a token in the URL
        // We need to be very permissive here to catch all possible token formats
        const hasToken = hash && (
          hash.includes('type=recovery') ||
          hash.includes('access_token=') ||
          hash.includes('for-password-reset') ||
          hash.includes('token=')
        );

        // Also check if the URL contains any parameters that might indicate a reset link
        const hasParams = location.search && (
          location.search.includes('token=') ||
          location.search.includes('type=recovery')
        );

          if (hasToken || hasParams) {
            console.log('RouteHandler - Found reset token or params, signing out user');
            // Force sign out any existing user
            await supabase.auth.signOut();
            // Let the normal routing continue
            setShouldRedirect(false);
          } else {
            console.log('RouteHandler - No reset token or params found, redirecting to password reset request page');
            // No token, redirect to password reset request page
            setRedirectPath('/password-reset');
            setShouldRedirect(true);
          }
        } else {
          // For all other routes, let normal routing continue
          setShouldRedirect(false);
        }
      } catch (error) {
        console.error('RouteHandler - Error:', error);
        // In case of error, let normal routing continue
        setShouldRedirect(false);
      } finally {
        setLoading(false);
      }
    };

    handleSpecialRoutes();
  }, [location]);

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

  if (shouldRedirect) {
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

export default RouteHandler;

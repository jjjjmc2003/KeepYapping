import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * This component handles auth redirects from Supabase
 * It's designed to be placed at the root route to catch all auth redirects
 */
function AuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a redirect with an auth token
    const handleAuthRedirect = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      const type = url.searchParams.get('type');
      
      console.log("Auth redirect detected:", { type, hasToken: !!token });
      
      if (token && type) {
        // This is an auth redirect
        if (type === 'recovery') {
          // Password recovery flow
          console.log("Redirecting to reset password page");
          navigate('/reset-password', { 
            state: { 
              recovery: true,
              token: token
            }
          });
        } else if (type === 'signup') {
          // Email confirmation flow
          console.log("Email confirmed, redirecting to login");
          navigate('/login', { 
            state: { 
              emailConfirmed: true 
            }
          });
        }
      }
    };

    handleAuthRedirect();
  }, [navigate]);

  // This component doesn't render anything visible
  return <div style={{ display: 'none' }}>Processing authentication...</div>;
}

export default AuthRedirect;

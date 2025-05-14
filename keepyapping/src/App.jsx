// Import React and its hooks for component creation and state management
import React, { useState, useEffect } from "react";
// Import routing components to handle navigation between different pages
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// Import toast notification component for showing alerts and messages
import { Toaster } from 'react-hot-toast';
// Import all our application components
import ChatApp from "./ChatApp";               // The main chat interface
import Login from "./Login";                   // Login page
import Signup from "./Signup";                 // Signup page
import HomePage from "./HomePage";             // Main dashboard after login
import PasswordReset from "./PasswordReset";   // Password reset form
import ResetPasswordWrapper from "./ResetPasswordWrapper"; // Handles password reset links
import RouteHandler from "./RouteHandler";     // Special route handling logic
import CreateGroupChat from "./CreateGroupChat"; // Group chat creation page
// Import our notification system that handles message alerts
import { NotificationProvider } from "./NotificationContext";

// Import Supabase client library for database and authentication
import * as SupabaseClient from "@supabase/supabase-js";

// Set up connection to our Supabase backend
// These are the connection details for our database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
// This is the public API key (safe to include in frontend code)
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Create a Supabase client we can use throughout the app
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Main App component - the entry point of our application
function App() {
  // Store the current user's information when logged in, null when logged out
  const [user, setUser] = useState(null);
  // Track whether we're still checking if the user is logged in
  const [loading, setLoading] = useState(true);

  // This effect runs once when the app starts
  useEffect(() => {
    // Function to check if the user is already logged in from a previous session
    const checkSession = async () => {
      try {
        // Ask Supabase if there's an active session (user already logged in)
        const { data, error } = await supabase.auth.getSession();

        // Handle any errors from the session check
        if (error) {
          console.error("Error checking session:", error);
          setLoading(false); // Stop the loading state even if there's an error
          return;
        }

        // If we found an active session, set the user state
        if (data.session) {
          setUser(data.session.user); // Store user details
        }
      } catch (err) {
        // Catch any unexpected errors
        console.error("Unexpected error checking session:", err);
      } finally {
        // Always stop the loading state when we're done checking
        setLoading(false);
      }
    };

    // Run the session check
    checkSession();

    // Set up a listener for authentication state changes
    // This will update our app when the user logs in or out
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // When a user signs in, update the user state
        if (event === "SIGNED_IN" && session) {
          setUser(session.user);
        }
        // When a user signs out, clear the user state
        else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    // Clean up function that runs when the component unmounts
    // This prevents memory leaks by removing the auth listener
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array means this only runs once when the app loads

  // Show a loading screen while we check if the user is logged in
  if (loading) {
    return (
      <div style={{
        display: "flex",                // Use flexbox for centering
        justifyContent: "center",       // Center horizontally
        alignItems: "center",           // Center vertically
        height: "100vh",                // Take up full viewport height
        backgroundColor: "#111",        // Dark background
        color: "white",                 // White text
        fontFamily: "'Inter', sans-serif" // Modern font
      }}>
        Loading...
      </div>
    );
  }



  // Render the application UI
  return (
    // Router handles navigation between different pages
    <Router>
      {/* NotificationProvider makes notifications available throughout the app */}
      <NotificationProvider>
        {/* RouteHandler manages special routes like password reset links */}
        <RouteHandler>
          <div>
            {/* Toast notifications appear in the top-right corner */}
            <Toaster position="top-right" />

            {/* Define all the routes (pages) in our application */}
            <Routes>
              {/* These routes are always accessible, even when logged out */}
              {/* Password reset routes don't require authentication */}
              <Route path="/reset-password" element={<ResetPasswordWrapper />} />
              <Route path="/password-reset" element={<PasswordReset />} />

              {/* Show different routes based on whether the user is logged in */}
              {!user ? (
                // Routes for logged-out users
                <>
                  {/* Signup page */}
                  <Route path="/signup" element={<Signup />} />
                  {/* Login page - passes the setUser function to update state when login succeeds */}
                  <Route path="/login" element={<Login onLogin={setUser} />} />
                  {/* Catch-all route - redirects to login for any unknown path */}
                  <Route path="*" element={<Login onLogin={setUser} />} />
                </>
              ) : (
                // Routes for logged-in users
                <>
                  {/* Home page - passes a logout function that clears the user state */}
                  <Route path="/" element={<HomePage onLogout={() => setUser(null)} />} />
                  {/* Chat page - also has logout functionality */}
                  <Route path="/chat" element={<ChatApp onLogout={() => setUser(null)} />} />
                  {/* Group chat creation page - passes the user's email */}
                  <Route path="/create-group" element={<CreateGroupChat currentUserEmail={user.email} />} />
                  {/* Catch-all route for logged-in users - goes to home page */}
                  <Route path="*" element={<HomePage onLogout={() => setUser(null)} />} />
                </>
              )}
            </Routes>
          </div>
        </RouteHandler>
      </NotificationProvider>
    </Router>
  );
}

// Export the App component as the default export so it can be imported in other files
export default App;
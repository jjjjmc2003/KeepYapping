import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import ChatApp from "./ChatApp";
import Login from "./Login";
import Signup from "./Signup";
import HomePage from "./HomePage";
import PasswordReset from "./PasswordReset";
import ResetPasswordWrapper from "./ResetPasswordWrapper";
import RouteHandler from "./RouteHandler";
import CreateGroupChat from "./CreateGroupChat";
import { NotificationProvider } from "./NotificationContext";

// Import Supabase
import * as SupabaseClient from "@supabase/supabase-js";

// Supabase Setup
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Let the RouteHandler component handle special routes
        // We'll just check for a session normally
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error checking session:", error);
          setLoading(false);
          return;
        }

        if (data.session) {
          setUser(data.session.user);
        }
      } catch (err) {
        console.error("Unexpected error checking session:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setUser(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    // Clean up subscription on unmount
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  if (loading) {
    // You could show a loading spinner here
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



  return (
    <Router>
      <NotificationProvider>
        <RouteHandler>
          <div>
            {/* Toast notifications container */}
            <Toaster position="top-right" />

            <Routes>
              {/* Always accessible routes */}
              <Route path="/reset-password" element={<ResetPasswordWrapper />} />
              <Route path="/password-reset" element={<PasswordReset />} />

              {/* Conditional routes based on authentication */}
              {!user ? (
                <>
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/login" element={<Login onLogin={setUser} />} />
                  <Route path="*" element={<Login onLogin={setUser} />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<HomePage onLogout={() => setUser(null)} />} />
                  <Route path="/chat" element={<ChatApp onLogout={() => setUser(null)} />} />
                  <Route path="/create-group" element={<CreateGroupChat currentUserEmail={user.email} />} />
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

export default App;
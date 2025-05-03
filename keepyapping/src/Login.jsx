import { Link, useNavigate } from "react-router-dom"; // Import useNavigate
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Hook to navigate to a different page

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      // Login request
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Login failed. Please check your credentials and verify your account.");
        return;
      }

      const { user } = data;

      // Ensure email is verified
      if (!user?.email_confirmed_at) {
        setError("Your account is not verified. Please check your email.");
        return;
      }

      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

        if (selectError && selectError.code !== "PGRST116") {
        setError("Error checking registration status.");
        return;
        }

        if (!existingUser) {
        // Insert default values for missing user
        const { error: insertError } = await supabase.from("users").insert([
            {
            email,
            name: "",         // Default empty or fetch from elsewhere
            bio: "",
            displayname: "",  // You could later require user to update it
            },
        ]);

        if (insertError) {
            setError(`Failed to register user info: ${insertError.message}`);
            return;
        }
        }


      // Everything is good, set the logged-in user and redirect
      setError("");
      if (onLogin) onLogin(user);
      
      // Redirect to the homepage/dashboard
      navigate("/dashboard");  // Adjust this URL to your preferred redirect page

    } catch (error) {
      setError(`Unexpected error: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", textAlign: "center" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "10px" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </form>
      <div style={{ marginTop: "20px" }}>
        <p>
          Don't have an account? <Link to="/signup">Sign up here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;

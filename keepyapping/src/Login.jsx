import { Link, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "../styles/Auth.css";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Login failed. Please check your credentials and/or verify your account.");
        return;
      }

      const { user } = data;

      // Optional: check if user exists in 'users' table, insert if missing
      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking user table:", selectError);
        setError("An error occurred while checking your profile.");
        return;
      }

      if (!existingUser) {
        await supabase.from("users").insert([
          {
            email: user.email,
            name: "",
            bio: "",
            displayname: "",
          },
        ]);
      }

      setError("");
      if (onLogin) onLogin(user);
      navigate("/");
    } catch (error) {
      setError(`Unexpected error: ${error.message}`);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome to KeepYapping</h2>
          <p>Log in to your account</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="auth-button" type="submit">
            Log In
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;

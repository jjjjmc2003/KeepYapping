import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import backgroundImage from "./Images/KeepYappingLogo.png";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Signup() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [displayname, setDisplayname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!name || !bio || !email || !displayname || !password) {
      setError("All fields are required.");
      return;
    }

    try {
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .single();

      if (emailCheckError && emailCheckError.code !== "PGRST116") {
        setError(`Error checking email: ${emailCheckError.message}`);
        return;
      }

      if (existingEmail) {
        setError("This email is already associated with an account.");
        return;
      }

      const { data: existingDisplayname, error: displaynameCheckError } =
        await supabase
          .from("users")
          .select("displayname")
          .eq("displayname", displayname)
          .single();

      if (displaynameCheckError && displaynameCheckError.code !== "PGRST116") {
        setError(`Error checking display name: ${displaynameCheckError.message}`);
        return;
      }

      if (existingDisplayname) {
        setError("This display name is already taken.");
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }

      const { error: insertError } = await supabase.from("users").insert([
        {
          email,
          name,
          bio,
          displayname,
        },
      ]);

      if (insertError) {
        setError(`Failed to save user info: ${insertError.message}`);
        return;
      }

      setMessage("Account has been created! Please check your email to confirm your account.");

      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    }
  };

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
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#fff" }}>Create an Account</h2>
          <p style={{ color: "#ccc" }}>Join KeepYapping today</p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
          {message && <div style={{ color: "lightgreen", marginBottom: "10px" }}>{message}</div>}

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

          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" style={{ color: "#ccc" }}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              style={inputStyle}
            />
          </div>

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
            }}
          >
            Sign Up
          </button>
        </form>

        <div className="auth-footer" style={{ textAlign: "center", marginTop: "1rem" }}>
          <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#6366f1", textDecoration: "none" }}>
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Animation keyframes */}
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

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  backgroundColor: "#1e1e1e",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "8px",
  fontSize: "1rem",
};

export default Signup;

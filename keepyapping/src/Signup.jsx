import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

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
  const [message, setMessage] = useState(""); // Add this state for success messages
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage(""); // Clear any previous messages

    if (!name || !bio || !email || !displayname || !password) {
      setError("All fields are required.");
      return;
    }

    try {
      // Check for duplicate email
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

      // Check for duplicate display name
      const { data: existingDisplayname, error: displaynameCheckError } = await supabase
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

      // Create auth user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }

      // Insert profile data to users table
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

      // Log success and show confirmation message
      console.log("✅ User data stored in database:", {
        email,
        name,
        bio,
        displayname,
      });

      setError(""); // Clear any previous errors
      setMessage("Account has been created! Please check your email to confirm your account.");
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", textAlign: "center" }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <textarea
          placeholder="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", minHeight: "100px" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <input
          type="text"
          placeholder="Display Name"
          value={displayname}
          onChange={(e) => setDisplayname(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />
        {error && <p style={{ color: "red" }}>{error}</p>}
        {message && <p style={{ color: "green" }}>{message}</p>}
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
          Sign Up
        </button>
      </form>
    </div>
  );
}

export default Signup;
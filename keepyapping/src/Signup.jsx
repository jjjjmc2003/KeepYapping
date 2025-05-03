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
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
  
    if (!name || !bio || !email || !displayname || !password) {
      setError("All fields are required.");
      return;
    }
  
    try {
      // Step 1: Check if the email already exists
      const { data: existingEmail } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .single();
  
      if (existingEmail) {
        setError("This email is already associated with an account.");
        return;
      }
  
      // Step 2: Check if displayname already exists
      const { data: existingDisplayname } = await supabase
        .from("users")
        .select("displayname")
        .eq("displayname", displayname)
        .single();
  
      if (existingDisplayname) {
        setError("This display name is already taken.");
        return;
      }
  
      // Step 3: Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
  
      if (signUpError) {
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }
  
      // Step 4: Wait until the session is active
      const { data: sessionData } = await supabase.auth.getSession();
  
      if (!sessionData.session) {
        //setError("Could not establish session. Please check your email for a confirmation link.");
        return;
      }
  
      // Step 5: Insert user data into 'users' table
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
  
      // Success
      navigate("/login");
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    }
  };
  

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", textAlign: "center" }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <textarea
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px", minHeight: "100px" }}
          />
        </div>
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
            type="text"
            placeholder="Display Name"
            value={displayname}
            onChange={(e) => setDisplayname(e.target.value)}
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
          Sign Up
        </button>
      </form>
    </div>
  );
}

export default Signup;
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

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (signUpError) {
        setError(`Sign-up failed: ${signUpError.message}`);
        return;
      }
      
      // ✅ Get the new user's ID (required for RLS auth)
      const user_id = signUpData?.user?.id;
      
      // ✅ Check: Are we signed in yet?
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();
      
      
      // ✅ Now insert into users table with authenticated session
      const { error: insertError } = await supabase.from("users").insert([
        {
          email,
          name,
          bio,
          displayname,
          user_id, // assuming your table has a user_id column
        },
      ]);
      
      if (insertError) {
        setError(`Failed to save user info: ${insertError.message}`);
        return;
      }
      

      setError("");
      navigate("/login");
    } catch (error) {
      setError(`Unexpected error: ${error.message}`);
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

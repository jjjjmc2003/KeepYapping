import React, { useState, useEffect } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/ProfileEditor.css";
import avatars from "./avatars";

// Supabase Setup
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function ProfileEditor({ userEmail, onProfileUpdate }) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarId, setAvatarId] = useState(1); // Default avatar ID
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isEditing, setIsEditing] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    async function fetchUserProfile() {
      if (!userEmail) return;

      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", userEmail)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (data) {
          setName(data.name || "");
          setDisplayName(data.displayname || "");
          setOriginalDisplayName(data.displayname || "");
          setBio(data.bio || "");
          setAvatarId(data.avatar_id || 1); // Default to 1 if not set
        }
      } catch (err) {
        console.error("Unexpected error fetching user profile:", err);
      }
    }

    fetchUserProfile();
  }, [userEmail]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // Check if user is authenticated
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        setMessage({
          text: "You must be logged in to update your profile.",
          type: "error"
        });
        setLoading(false);
        return;
      }

      // Check if user exists in the users table
      const { error: userCheckError } = await supabase
        .from("users")
        .select("*")
        .eq("email", userEmail)
        .single();

      if (userCheckError && userCheckError.code !== "PGRST116") {
        console.error("Error checking if user exists:", userCheckError);
        setMessage({
          text: "An error occurred while checking your profile. Please try again.",
          type: "error"
        });
        setLoading(false);
        return;
      }

      const userExists = !userCheckError;

      // Validate display name uniqueness if it has changed
      if (displayName !== originalDisplayName) {
        const { data: existingDisplayName, error: displayNameError } = await supabase
          .from("users")
          .select("displayname, email")
          .eq("displayname", displayName)
          .single();

        if (existingDisplayName && existingDisplayName.email !== userEmail) {
          setMessage({
            text: "This display name is already taken. Please choose another one.",
            type: "error"
          });
          setLoading(false);
          return;
        }

        if (displayNameError && displayNameError.code !== "PGRST116") {
          console.error("Error checking display name:", displayNameError);
          setMessage({
            text: "An error occurred while checking display name availability.",
            type: "error"
          });
          setLoading(false);
          return;
        }
      }

      // Prepare the user data
      const userData = {
        email: userEmail,
        name,
        displayname: displayName,
        bio,
        avatar_id: avatarId
      };

      let updateResult;

      // Insert or update based on whether user exists
      if (!userExists) {
        // Insert new user
        updateResult = await supabase
          .from("users")
          .insert([userData]);
      } else {
        // Update existing user
        updateResult = await supabase
          .from("users")
          .update({
            name,
            displayname: displayName,
            bio,
            avatar_id: avatarId
          })
          .eq("email", userEmail);
      }

      const { error: updateError } = updateResult;

      if (updateError) {
        console.error("Error updating user profile:", updateError);
        setMessage({
          text: "Failed to update profile. Please try again.",
          type: "error"
        });
        setLoading(false);
        return;
      }

      // If display name has changed, check if friend_requests table has display name columns
      if (displayName !== originalDisplayName) {
        try {
          // Check if the friend_requests table has the expected columns
          const { data: tableInfo } = await supabase
            .from("friend_requests")
            .select("*")
            .limit(1);

          // Get the column names from the first row if available
          const columnNames = tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : [];

          // Check if the sender_display_name column exists
          const hasSenderDisplayName = columnNames.includes("sender_display_name");
          const hasReceiverDisplayName = columnNames.includes("receiver_display_name");

          // Only update if the columns exist
          if (hasSenderDisplayName) {
            // Update sender_email entries
            await supabase
              .from("friend_requests")
              .update({ sender_display_name: displayName })
              .eq("sender_email", userEmail);
          }

          if (hasReceiverDisplayName) {
            // Update receiver_email entries
            await supabase
              .from("friend_requests")
              .update({ receiver_display_name: displayName })
              .eq("receiver_email", userEmail);
          }
        } catch (friendRequestError) {
          console.error("Error updating friend_requests:", friendRequestError);
          // Don't fail the whole operation if friend_requests update fails
        }
      }

      setMessage({
        text: "Profile updated successfully!",
        type: "success"
      });

      setOriginalDisplayName(displayName);
      setIsEditing(false);

      // Notify parent component about the update
      if (onProfileUpdate) {
        onProfileUpdate({
          name,
          displayname: displayName,
          bio,
          avatar_id: avatarId
        });
      }
    } catch (err) {
      console.error("Unexpected error updating profile:", err);
      setMessage({
        text: "An unexpected error occurred. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-editor">
      <div className="profile-editor-header">
        <h2>Your Profile</h2>
        {!isEditing && (
          <button
            className="btn btn-primary edit-profile-btn"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Choose a display name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              required
            />
          </div>

          <div className="form-group">
            <label>Avatar</label>
            <div className="avatar-selection">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className={`avatar-option ${avatarId === avatar.id ? 'selected' : ''}`}
                  onClick={() => setAvatarId(avatar.id)}
                >
                  <img src={avatar.url} alt={avatar.name} />
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsEditing(false);
                setName(name);
                setDisplayName(originalDisplayName);
                setBio(bio);
                setMessage({ text: "", type: "" });
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="profile-display">
          <div className="profile-field">
            <div className="field-label">Avatar:</div>
            <div className="field-value">
              <div className="current-avatar">
                <img
                  src={avatars.find(a => a.id === avatarId)?.url || avatars[0].url}
                  alt="Your avatar"
                />
              </div>
            </div>
          </div>
          <div className="profile-field">
            <div className="field-label">Email:</div>
            <div className="field-value">{userEmail}</div>
          </div>
          <div className="profile-field">
            <div className="field-label">Full Name:</div>
            <div className="field-value">{name || "Not set"}</div>
          </div>
          <div className="profile-field">
            <div className="field-label">Display Name:</div>
            <div className="field-value">{displayName || "Not set"}</div>
          </div>
          <div className="profile-field">
            <div className="field-label">Bio:</div>
            <div className="field-value bio-text">{bio || "Not set"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileEditor;

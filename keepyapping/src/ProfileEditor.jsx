/**
 * ProfileEditor.jsx
 *
 * This component provides a user profile management interface for the KeepYapping application.
 * It allows users to view and edit their profile information including:
 * - Full name
 * - Display name with uniqueness validation
 * - Bio
 * - Avatar both predefined options and custom uploads
 *
 * The component handles both viewing and editing modes, with proper validation
 * and error handling for all operations.
 */

import React, { useState, useEffect, useRef } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/ProfileEditor.css";
// Import avatar options and custom avatar ID constant
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";

// Supabase connection configuration
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Initialize Supabase client for database operations
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ProfileEditor component for managing user profile information
 * - The email of the current user
 * @param {string} userEmail
 * - Callback function to notify parent component when profile is updated
 * @param {Function} onProfileUpdate
 * The profile editor UI
 * @returns {JSX.Element}
 */
function ProfileEditor({ userEmail, onProfileUpdate }) {
  // State variables for user profile data
  // User's full name
  const [name, setName] = useState("");          
  // User's display name shown in the app           
  const [displayName, setDisplayName] = useState("");      
  // User's bio/about text 
  const [bio, setBio] = useState("");       
  // Selected avatar ID 1 is default                
  const [avatarId, setAvatarId] = useState(1);    
  // URL for custom uploaded avatar          
  const [customAvatarUrl, setCustomAvatarUrl] = useState(""); 

  // State variables for UI and operation status
  // Track avatar upload status
  const [isUploading, setIsUploading] = useState(false);  
  // For checking if display name changed  
  const [originalDisplayName, setOriginalDisplayName] = useState(""); 
  // Track form submission status
  const [loading, setLoading] = useState(false);       
  // Feedback messages     
  const [message, setMessage] = useState({ text: "", type: "" }); 
  // Toggle between view/edit modes
  const [isEditing, setIsEditing] = useState(false);        

  // Reference to hidden file input for avatar upload
  const fileInputRef = useRef(null);

  /**
   * Effect hook to fetch user profile data when component mounts or userEmail changes
   * Retrieves profile information from the database and populates the form fields
   */
  useEffect(() => {
    async function fetchUserProfile() {
      // Don't attempt to fetch if no email is provided
      if (!userEmail) return;

      try {
        // Query the users table for the current user's profile data
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", userEmail)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        // If user data exists, populate the form fields
        if (data) {
          setName(data.name || "");
          setDisplayName(data.displayname || "");
          // Store original for comparison
          setOriginalDisplayName(data.displayname || ""); 
          setBio(data.bio || "");
          // Default to first avatar if not set
          setAvatarId(data.avatar_id || 1); 
          // Set custom avatar URL if exists
          setCustomAvatarUrl(data.custom_avatar_url || ""); 
        }
      } catch (err) {
        console.error("Unexpected error fetching user profile:", err);
      }
    }

    // Call the function to fetch profile data
    fetchUserProfile();
    // Re-run when userEmail changes
  }, [userEmail]); 

  /**
   * Handles the custom avatar image upload process
   * Validates the file, uploads it to Supabase storage, and updates the avatar selection
   *- The file input change event
   * @param {Event} event 
   */
  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    // No file selected
    if (!file) return; 

    // Validate file type must be an image
    if (!file.type.startsWith("image/")) {
      setMessage({
        text: "Please select an image file.",
        type: "error"
      });
      return;
    }

    // Validate file size 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        text: "File size exceeds 5MB limit.",
        type: "error"
      });
      return;
    }

    // Update UI to show upload in progress
    setIsUploading(true);
    setMessage({ text: "Uploading avatar...", type: "info" });

    try {
      // Create a unique file name to prevent collisions
      const fileExtension = file.name.split(".").pop();
      const fileName = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      // Organize by user email
      const filePath = `avatars/${userEmail}/${fileName}`; 

      // Check if avatars bucket exists, if not create it
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      // Create the avatars bucket if it doesn't exist
      if (!buckets.find(bucket => bucket.name === "avatars")) {
        const { error: createError } = await supabase.storage.createBucket("avatars", {
          // Make bucket publicly accessible for avatar images
          public: true 
        });

        if (createError) {
          throw new Error(`Failed to create avatars bucket: ${createError.message}`);
        }
      }

      // Upload the image to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          // Cache control for 1 hour
          cacheControl: '3600', 
          // Overwrite if file exists
          upsert: true 
        });

      if (uploadError) {
        throw new Error(`Error uploading avatar: ${uploadError.message}`);
      }

      // Get the public URL of the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update state with the new avatar information
      setCustomAvatarUrl(publicUrl);
      // Switch to custom avatar mode
      setAvatarId(CUSTOM_AVATAR_ID); 
      setMessage({ text: "Avatar uploaded successfully!", type: "success" });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setMessage({
        text: `Error uploading avatar: ${error.message}`,
        type: "error"
      });
    } finally {
      // Reset uploading state
      setIsUploading(false); 
    }
  };

  /**
   * Handles the profile update form submission
   * Validates inputs, checks for display name uniqueness, and updates the user profile in the database
   * - The form submission event
   * @param {Event} e 
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Clear previous messages
    setMessage({ text: "", type: "" }); 

    try {
      // Verify user authentication
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

      // Handle database query errors ignore "not found" errors
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

        // If display name exists and belongs to another user
        if (existingDisplayName && existingDisplayName.email !== userEmail) {
          setMessage({
            text: "This display name is already taken. Please choose another one.",
            type: "error"
          });
          setLoading(false);
          return;
        }

        // Handle database query errors ignore "not found" errors
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

      // Prepare the user data for database operation
      const userData = {
        email: userEmail,
        name,
        displayname: displayName,
        bio,
        avatar_id: avatarId,
        custom_avatar_url: avatarId === CUSTOM_AVATAR_ID ? customAvatarUrl : null
      };

      let updateResult;

      // Insert or update based on whether user exists
      if (!userExists) {
        // Insert new user record
        updateResult = await supabase
          .from("users")
          .insert([userData]);
      } else {
        // Update existing user record
        updateResult = await supabase
          .from("users")
          .update({
            name,
            displayname: displayName,
            bio,
            avatar_id: avatarId,
            custom_avatar_url: avatarId === CUSTOM_AVATAR_ID ? customAvatarUrl : null
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

      // Update display name in friend_requests table if it changed
      if (displayName !== originalDisplayName) {
        try {
          // Check if the friend_requests table has the display name columns
          const { data: tableInfo } = await supabase
            .from("friend_requests")
            .select("*")
            .limit(1);

          // Get the column names from the first row if available
          const columnNames = tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : [];

          // Check if the display name columns exist
          const hasSenderDisplayName = columnNames.includes("sender_display_name");
          const hasReceiverDisplayName = columnNames.includes("receiver_display_name");

          // Only update if the columns exist
          if (hasSenderDisplayName) {
            // Update sender display name where this user is the sender
            await supabase
              .from("friend_requests")
              .update({ sender_display_name: displayName })
              .eq("sender_email", userEmail);
          }

          if (hasReceiverDisplayName) {
            // Update receiver display name where this user is the receiver
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

      // Show success message and update state
      setMessage({
        text: "Profile updated successfully!",
        type: "success"
      });

      // Update the original display name to the new one
      setOriginalDisplayName(displayName);
      // Exit editing mode
      setIsEditing(false);

      // Notify parent component about the update
      if (onProfileUpdate) {
        onProfileUpdate({
          name,
          displayname: displayName,
          bio,
          avatar_id: avatarId,
          custom_avatar_url: avatarId === CUSTOM_AVATAR_ID ? customAvatarUrl : null
        });
      }
    } catch (err) {
      console.error("Unexpected error updating profile:", err);
      setMessage({
        text: "An unexpected error occurred. Please try again.",
        type: "error"
      });
    } finally {
      // Reset loading state
      setLoading(false); 
    }
  };

  /**
   * Render the profile editor component
   * Shows either the view mode or edit mode based on isEditing state
   */
  return (
    <div className="profile-editor">
      {/* Header section with title and edit button */}
      <div className="profile-editor-header">
        <h2>Your Profile</h2>
        {/* Only show Edit button when not in editing mode */}
        {!isEditing && (
          <button
            className="btn btn-primary edit-profile-btn"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Message display for success/error feedback */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Conditional rendering based on editing mode */}
      {isEditing ? (
        // Edit mode - form for updating profile information
        <form onSubmit={handleSubmit}>
          {/* Full Name field */}
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

          {/* Display Name field - must be unique */}
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

          {/* Bio field */}
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

          {/* Avatar selection section */}
          <div className="form-group">
            <label>Avatar</label>
            {/* Hidden file input for custom avatar upload */}
            <div className="avatar-upload-container">
              <input
                type="file"
                id="avatar-upload"
                // Only allow image files
                accept="image/*" 
                onChange={handleAvatarUpload}
                ref={fileInputRef}
                // Hidden but accessible via button
                style={{ display: "none" }} 
              />
              <button
                type="button"
                className="btn btn-secondary upload-avatar-btn"
                // Trigger file input click
                onClick={() => fileInputRef.current.click()} 
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload Custom Avatar"}
              </button>
            </div>

            {/* Avatar selection grid */}
            <div className="avatar-selection">
              {/* Custom avatar preview - only shown if uploaded */}
              {avatarId === CUSTOM_AVATAR_ID && customAvatarUrl && (
                <div
                  className={`avatar-option selected custom-avatar`}
                  onClick={() => setAvatarId(CUSTOM_AVATAR_ID)}
                >
                  <img src={customAvatarUrl} alt="Custom Avatar" />
                </div>
              )}

              {/* Predefined avatars from the avatars array */}
              {avatars.filter(avatar => avatar.id !== CUSTOM_AVATAR_ID).map((avatar) => (
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

          {/* Form action buttons */}
          <div className="form-actions">
            {/* Cancel button - resets form to original values */}
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
            {/* Submit button - saves changes */}
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
        // View mode - display current profile information
        <div className="profile-display">
          {/* Avatar display */}
          <div className="profile-field">
            <div className="field-label">Avatar:</div>
            <div className="field-value">
              <div className="current-avatar">
                {/* Show custom avatar if selected and available */}
                {avatarId === CUSTOM_AVATAR_ID && customAvatarUrl ? (
                  <img src={customAvatarUrl} alt="Your custom avatar" />
                ) : (
                  // Otherwise show selected predefined avatar or default
                  <img
                    src={avatars.find(a => a.id === avatarId)?.url || avatars[0].url}
                    alt="Your avatar"
                  />
                )}
              </div>
            </div>
          </div>
          {/* Email field - not editable */}
          <div className="profile-field">
            <div className="field-label">Email:</div>
            <div className="field-value">{userEmail}</div>
          </div>
          {/* Full Name field */}
          <div className="profile-field">
            <div className="field-label">Full Name:</div>
            <div className="field-value">{name || "Not set"}</div>
          </div>
          {/* Display Name field */}
          <div className="profile-field">
            <div className="field-label">Display Name:</div>
            <div className="field-value">{displayName || "Not set"}</div>
          </div>
          {/* Bio field */}
          <div className="profile-field">
            <div className="field-label">Bio:</div>
            <div className="field-value bio-text">{bio || "Not set"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the component for use in other parts of the application
export default ProfileEditor;

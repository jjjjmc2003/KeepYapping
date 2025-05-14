// This file contains the component for creating new group chats
// It allows users to name a group and add friends from a searchable dropdown

// Import React and its hooks for building our component
import React, { useState, useEffect } from "react";
// Import Supabase client for database operations
import * as SupabaseClient from "@supabase/supabase-js";
// Import CSS styles for this component
import "../styles/GroupChatCreator.css";
// Import avatar images and the special ID for custom avatars
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";

// Connection details for our Supabase database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Create a Supabase client we'll use throughout the component
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Main component for creating a new group chat
// Takes the current user's email and a callback function to run when a group is created
function GroupChatCreator({ currentUserEmail, onGroupChatCreated }) {
  // State for the name of the group being created
  const [groupName, setGroupName] = useState("");

  // State for the friend search functionality
  const [searchTerm, setSearchTerm] = useState("");          // What the user types in the search box
  const [friends, setFriends] = useState([]);                // List of all the user's friends
  const [filteredFriends, setFilteredFriends] = useState([]); // Friends filtered by search term
  const [selectedFriends, setSelectedFriends] = useState([]); // Friends selected to add to the group
  const [showDropdown, setShowDropdown] = useState(false);   // Whether to show the search dropdown

  // State for error and success messages
  const [error, setError] = useState("");                    // Error message to display
  const [success, setSuccess] = useState("");                // Success message to display

  // This effect runs when the component mounts to load friends and set up real-time updates
  useEffect(() => {
    // Load the initial list of friends
    fetchFriends();

    // Set up a timer to periodically refresh the friends list
    // This ensures the UI stays up-to-date even if real-time updates fail
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of friends list in GroupChatCreator");
      fetchFriends();
    }, 5000); // Refresh every 5 seconds

    // Set up real-time updates for friend requests
    // This will update the friends list immediately when friend status changes
    if (currentUserEmail) {
      console.log("Setting up real-time subscription for friend requests in GroupChatCreator");

      // Create a unique channel name based on the user's email
      // This prevents conflicts with other users' channels
      const userPrefix = currentUserEmail.replace(/[^a-zA-Z0-9]/g, '');

      // Create a subscription to listen for friend request changes
      const subscription = supabase
        .channel(`group-creator-friends-${userPrefix}`)
        // Listen for changes to requests sent by this user
        .on(
          "postgres_changes", // Listen for database changes
          {
            event: "*",                // Any event (insert, update, delete)
            schema: "public",          // In the public schema
            table: "friend_requests",  // On the friend_requests table
            filter: `sender_email=eq.${currentUserEmail}` // Where user is the sender
          },
          (payload) => {
            // When a change is detected, refresh the friends list
            console.log("Friend request from current user updated in GroupChatCreator:", payload);
            fetchFriends();
          }
        )
        // Also listen for changes to requests received by this user
        .on(
          "postgres_changes", // Listen for database changes
          {
            event: "*",                // Any event (insert, update, delete)
            schema: "public",          // In the public schema
            table: "friend_requests",  // On the friend_requests table
            filter: `receiver_email=eq.${currentUserEmail}` // Where user is the receiver
          },
          (payload) => {
            // When a change is detected, refresh the friends list
            console.log("Friend request to current user updated in GroupChatCreator:", payload);
            fetchFriends();
          }
        )
        .subscribe();

      console.log("Friend requests subscription active in GroupChatCreator");

      // Clean up function that runs when the component unmounts
      // or when currentUserEmail changes
      return () => {
        console.log("Cleaning up friend requests subscription and interval in GroupChatCreator");
        clearInterval(refreshInterval); // Stop the periodic refresh
        supabase.removeChannel(subscription); // Remove the subscription
      };
    }

    // If we don't have a user email, just clean up the interval
    return () => {
      clearInterval(refreshInterval);
    };
  }, [currentUserEmail]); // Re-run this effect if the user email changes

  // This effect filters the friends list based on what the user types in the search box
  useEffect(() => {
    // If the search box is empty, clear the filtered list
    if (searchTerm.trim() === "") {
      setFilteredFriends([]);
      return;
    }

    // Filter friends whose display name or email contains the search term
    const filtered = friends.filter(friend =>
      // Use display name if available, otherwise use email
      // Do a case-insensitive search for the term
      (friend.displayName || friend.email).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Update the filtered friends list
    setFilteredFriends(filtered);
  }, [searchTerm, friends]); // Re-run when search term or friends list changes

  // Function to load the user's friends from the database
  const fetchFriends = async () => {
    // Don't do anything if we don't have a user email
    if (!currentUserEmail) return;

    try {
      // Step 1: Get all accepted friend requests involving this user
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`) // Either sender or receiver
        .eq("status", "accepted"); // Only accepted requests (these are actual friends)

      // Handle errors getting friend requests
      if (error) {
        console.error("Error fetching friends:", error);
        setError("Failed to load friends list");
        return;
      }

      // Step 2: Extract the email addresses of all friends
      // For each request, get the email of the other person (not the current user)
      const friendEmails = requestsData.map((req) =>
        req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
      );

      // Step 3: Get additional details for each friend (display name, avatar)
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id, custom_avatar_url")
        .in("email", friendEmails); // Get all these users in one query

      // Handle errors getting user details
      if (usersError) {
        console.error("Error fetching friend display names:", usersError);
        setError("Failed to load friend details");
        return;
      }

      // Step 4: Create enhanced friend objects with all the details we need
      const enhancedFriends = friendEmails.map(email => {
        // Find this friend's details in the users data
        const user = usersData.find(u => u.email === email);
        // Create an object with all the friend's details
        return {
          email: email, // The friend's email address
          displayName: user?.displayname || email, // Display name or fall back to email
          avatarId: user?.avatar_id || 1, // Avatar ID or default to 1
          // Only include custom avatar URL if they have a custom avatar
          customAvatarUrl: user?.avatar_id === CUSTOM_AVATAR_ID ? user?.custom_avatar_url : null
        };
      });

      // Step 5: Store custom avatar URLs in localStorage for use across the app
      const customAvatarMap = {};
      // Find all users with custom avatars
      usersData.forEach(user => {
        if (user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url) {
          customAvatarMap[user.email] = user.custom_avatar_url;
        }
      });

      // Update the localStorage with any new custom avatars
      try {
        // Get existing custom avatars from localStorage
        const existingMap = JSON.parse(localStorage.getItem('friendCustomAvatars') || '{}');
        // Merge with new custom avatars
        const updatedMap = { ...existingMap, ...customAvatarMap };
        // Save back to localStorage
        localStorage.setItem('friendCustomAvatars', JSON.stringify(updatedMap));
      } catch (error) {
        console.error("Error updating friendCustomAvatars in localStorage:", error);
      }

      // Step 6: Update state with the enhanced friends list
      setFriends(enhancedFriends);
      setError(""); // Clear any previous errors
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error in fetchFriends:", error);
      setError("An unexpected error occurred");
    }
  };

  // Function to add or remove a friend from the selected list
  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev => {
      // Check if this friend is already in the selected list
      const isSelected = prev.some(f => f.email === friend.email);

      if (isSelected) {
        // If already selected, remove them from the list
        // by filtering out this friend's email
        return prev.filter(f => f.email !== friend.email);
      } else {
        // If not selected, add them to the list
        // by creating a new array with this friend added
        return [...prev, friend];
      }
    });
  };

  // Function to handle when the user types in the search box
  const handleSearchInputChange = (e) => {
    // Get what the user typed
    const value = e.target.value;
    // Update the search term state
    setSearchTerm(value);
    // Show the dropdown if there's text in the search box
    // Hide it if the search box is empty
    setShowDropdown(value.trim() !== "");
  };

  // Function to create a new group chat when the user clicks the Create button
  const handleCreateGroupChat = async () => {
    // Step 1: Validate the inputs before proceeding
    // Make sure the group name isn't empty
    if (!groupName.trim()) {
      setError("Please enter a group chat name");
      return;
    }

    // Make sure at least one friend is selected
    if (selectedFriends.length === 0) {
      setError("Please select at least one friend");
      return;
    }

    try {
      console.log("Creating group chat with name:", groupName);
      console.log("Selected friends:", selectedFriends);

      // Step 2: Create the group chat in the database
      const { data: groupChatData, error: groupChatError } = await supabase
        .from("group_chats")
        .insert([{
          name: groupName,           // The name of the group
          creator: currentUserEmail, // Who created the group
          created_at: new Date().toISOString() // Current timestamp
        }])
        .select(); // Return the created group data

      // Handle errors creating the group
      if (groupChatError) {
        console.error("Error creating group chat:", groupChatError);
        setError("Failed to create group chat: " + groupChatError.message);
        return;
      }

      // Make sure we got data back
      if (!groupChatData || groupChatData.length === 0) {
        console.error("No group chat data returned after insert");
        setError("Failed to create group chat: No data returned");
        return;
      }

      // Get the newly created group chat
      const newGroupChat = groupChatData[0];
      console.log("Created group chat:", newGroupChat);

      // Step 3: Add all members to the group_chat_members table
      const memberInserts = [
        // Add the creator as a member
        {
          group_id: newGroupChat.id,
          member_email: currentUserEmail
        },
        // Add all selected friends as members
        ...selectedFriends.map(friend => ({
          group_id: newGroupChat.id,
          member_email: friend.email
        }))
      ];

      // Insert all members in one query
      const { error: membersError } = await supabase
        .from("group_chat_members")
        .insert(memberInserts);

      // Log errors but continue - we want to send messages even if this fails
      if (membersError) {
        console.error("Error adding members to group chat:", membersError);
        // Don't return here, we'll continue anyway to send messages
      }

      // Step 4: Send welcome messages to make the group chat visible to all members
      // First, send a creation message
      const creationMessage = {
        text: `Created group chat "${groupName}"`, // Message text
        sender: currentUserEmail,                 // From the creator
        type: "groupchat",                        // Message type
        recipient: `group:${newGroupChat.id}`,    // To the group
        created_at: new Date().toISOString()      // Current timestamp
      };

      // Send the creation message
      try {
        const { error: creationError } = await supabase
          .from("messages")
          .insert([creationMessage]);

        if (creationError) {
          console.error("Error sending creation message:", creationError);
        }
      } catch (error) {
        console.error("Error sending creation message:", error);
      }

      // Step 5: Send individual "added" messages for each member
      // This helps trigger notifications for each member
      for (const friend of selectedFriends) {
        // Create a message saying this friend was added
        const addMemberMessage = {
          text: `Added ${friend.email} to the group chat`,
          sender: currentUserEmail,
          type: "groupchat",
          recipient: `group:${newGroupChat.id}`,
          // Add a small offset to ensure unique timestamps
          created_at: new Date(Date.now() + 100).toISOString()
        };

        // Send the message
        try {
          const { error: msgError } = await supabase
            .from("messages")
            .insert([addMemberMessage]);

          if (msgError) {
            console.error(`Error sending add member message for ${friend.email}:`, msgError);
          }
        } catch (error) {
          console.error(`Error sending add member message for ${friend.email}:`, error);
        }
      }

      // Step 6: Save to localStorage for backward compatibility
      // Some parts of the app might still use localStorage instead of state
      try {
        // Get existing group chats from localStorage
        const storedGroupChats = localStorage.getItem('groupChats') || '[]';
        const parsedGroupChats = JSON.parse(storedGroupChats);

        // Create an enhanced group chat object with members list
        const groupChatForStorage = {
          ...newGroupChat, // All the original group chat data
          members: [
            currentUserEmail, // The creator
            ...selectedFriends.map(friend => friend.email) // All the friends
          ]
        };

        // Add the new group chat to the list
        parsedGroupChats.push(groupChatForStorage);

        // Save back to localStorage
        localStorage.setItem('groupChats', JSON.stringify(parsedGroupChats));
        console.log("Saved new group chat to localStorage:", groupChatForStorage);
      } catch (storageError) {
        console.error("Error saving to localStorage:", storageError);
      }

      // Step 7: Update UI to show success and reset form
      setSuccess("Group chat created successfully!");
      setGroupName(""); // Clear the group name input
      setSelectedFriends([]); // Clear the selected friends
      setSearchTerm(""); // Clear the search box

      // Step 8: Notify the parent component about the new group chat
      // This allows the parent to update its state and show the new chat
      if (onGroupChatCreated) {
        onGroupChatCreated(newGroupChat);
      }

      // Clear the success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error creating group chat:", error);
      setError("An unexpected error occurred: " + error.message);
    }
  };

  // Render the group chat creation form
  return (
    <div className="group-chat-creator">
      {/* Header section */}
      <div className="group-chat-creator-header">
        <h2>Create a Group Chat</h2>
      </div>

      {/* Main content area */}
      <div className="group-chat-creator-content">
        {/* Show error and success messages if they exist */}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Group name input field */}
        <div className="input-group">
          <label htmlFor="group-name">Group Chat Name</label>
          <input
            id="group-name"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)} // Update state as user types
            placeholder="Enter a name for your group chat"
          />
        </div>

        {/* Friend search section */}
        <div className="input-group">
          <label htmlFor="friend-search">Add Friends</label>
          <div className="search-input-wrapper">
            {/* Search input box */}
            <input
              id="friend-search"
              type="text"
              value={searchTerm}
              onChange={handleSearchInputChange} // Handle typing in the search box
              onFocus={() => setShowDropdown(searchTerm.trim() !== "")} // Show dropdown when focused if there's text
              placeholder="Search for friends to add"
            />
            {/* Dropdown showing search results */}
            {showDropdown && filteredFriends.length > 0 && (
              <div className="friends-dropdown">
                {/* Map through filtered friends and show each one */}
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.email} // Use email as unique key
                    className="friend-option"
                    onClick={() => {
                      toggleFriendSelection(friend); // Add/remove from selected list
                      setSearchTerm(""); // Clear search box
                      setShowDropdown(false); // Hide dropdown
                    }}
                  >
                    {/* Friend's avatar */}
                    <div className="friend-avatar">
                      {/* Show custom avatar if they have one */}
                      {friend.avatarId === CUSTOM_AVATAR_ID && friend.customAvatarUrl ? (
                        <img
                          src={friend.customAvatarUrl}
                          alt={friend.displayName || friend.email}
                        />
                      ) : friend.avatarId ? (
                        // Show standard avatar if they have one
                        <img
                          src={avatars.find(a => a.id === friend.avatarId)?.url || avatars[0].url}
                          alt={friend.displayName || friend.email}
                        />
                      ) : (
                        // Show first letter of name as fallback
                        (friend.displayName || friend.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Friend's name */}
                    <div className="friend-info">
                      {friend.displayName || friend.email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section showing friends that have been selected */}
        <div className="selected-friends">
          <h3>Selected Friends ({selectedFriends.length})</h3>
          {/* Show message if no friends selected */}
          {selectedFriends.length === 0 ? (
            <div className="no-friends-selected">No friends selected</div>
          ) : (
            // Otherwise show the list of selected friends
            <div className="selected-friends-list">
              {/* Map through selected friends and show each one */}
              {selectedFriends.map((friend) => (
                <div key={friend.email} className="selected-friend">
                  {/* Friend's avatar */}
                  <div className="friend-avatar">
                    {/* Show custom avatar if they have one */}
                    {friend.avatarId === CUSTOM_AVATAR_ID && friend.customAvatarUrl ? (
                      <img
                        src={friend.customAvatarUrl}
                        alt={friend.displayName || friend.email}
                      />
                    ) : friend.avatarId ? (
                      // Show standard avatar if they have one
                      <img
                        src={avatars.find(a => a.id === friend.avatarId)?.url || avatars[0].url}
                        alt={friend.displayName || friend.email}
                      />
                    ) : (
                      // Show first letter of name as fallback
                      (friend.displayName || friend.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* Friend's name */}
                  <div className="friend-info">
                    {friend.displayName || friend.email}
                  </div>
                  {/* Button to remove this friend from selection */}
                  <button
                    className="remove-friend-btn"
                    onClick={() => toggleFriendSelection(friend)}
                    aria-label={`Remove ${friend.displayName || friend.email}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create button - calls handleCreateGroupChat when clicked */}
        <button
          className="create-group-btn"
          onClick={handleCreateGroupChat}
        >
          Create Group Chat
        </button>
      </div>
    </div>
  );
}

// Export the GroupChatCreator component so it can be used in other files
export default GroupChatCreator;

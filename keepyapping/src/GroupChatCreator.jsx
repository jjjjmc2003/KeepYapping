// GroupChatCreator.jsx
import React, { useState, useEffect } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/GroupChatCreator.css";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function GroupChatCreator({ currentUserEmail, onGroupChatCreated }) {
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch friends list when component mounts
  useEffect(() => {
    fetchFriends();

    // Set up periodic refresh for friends list
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of friends list in GroupChatCreator");
      fetchFriends();
    }, 5000); // Refresh every 5 seconds

    // Set up real-time subscription for friend requests involving this user
    if (currentUserEmail) {
      console.log("Setting up real-time subscription for friend requests in GroupChatCreator");
      const userPrefix = currentUserEmail.replace(/[^a-zA-Z0-9]/g, '');

      const subscription = supabase
        .channel(`group-creator-friends-${userPrefix}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friend_requests",
            filter: `sender_email=eq.${currentUserEmail}`
          },
          (payload) => {
            console.log("Friend request from current user updated in GroupChatCreator:", payload);
            fetchFriends();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friend_requests",
            filter: `receiver_email=eq.${currentUserEmail}`
          },
          (payload) => {
            console.log("Friend request to current user updated in GroupChatCreator:", payload);
            fetchFriends();
          }
        )
        .subscribe();

      console.log("Friend requests subscription active in GroupChatCreator");

      return () => {
        console.log("Cleaning up friend requests subscription and interval in GroupChatCreator");
        clearInterval(refreshInterval);
        supabase.removeChannel(subscription);
      };
    }

    return () => {
      clearInterval(refreshInterval);
    };
  }, [currentUserEmail]);

  // Filter friends based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredFriends([]);
      return;
    }

    const filtered = friends.filter(friend =>
      (friend.displayName || friend.email).toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredFriends(filtered);
  }, [searchTerm, friends]);

  const fetchFriends = async () => {
    if (!currentUserEmail) return;

    try {
      // Get accepted friend requests
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
        .eq("status", "accepted");

      if (error) {
        console.error("Error fetching friends:", error);
        setError("Failed to load friends list");
        return;
      }

      // Extract friend emails
      const friendEmails = requestsData.map((req) =>
        req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
      );

      // Fetch display names for all friends
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname")
        .in("email", friendEmails);

      if (usersError) {
        console.error("Error fetching friend display names:", usersError);
        setError("Failed to load friend details");
        return;
      }

      // Create enhanced friend objects with both email and display name
      const enhancedFriends = friendEmails.map(email => {
        const user = usersData.find(u => u.email === email);
        return {
          email: email,
          displayName: user?.displayname || email
        };
      });

      setFriends(enhancedFriends);
      setError("");
    } catch (error) {
      console.error("Unexpected error in fetchFriends:", error);
      setError("An unexpected error occurred");
    }
  };

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev => {
      // Check if friend is already selected
      const isSelected = prev.some(f => f.email === friend.email);

      if (isSelected) {
        // Remove friend if already selected
        return prev.filter(f => f.email !== friend.email);
      } else {
        // Add friend if not selected
        return [...prev, friend];
      }
    });
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(value.trim() !== "");
  };

  const handleCreateGroupChat = async () => {
    // Validate inputs
    if (!groupName.trim()) {
      setError("Please enter a group chat name");
      return;
    }

    if (selectedFriends.length === 0) {
      setError("Please select at least one friend");
      return;
    }

    try {
      // Create a new group chat object
      const newGroupChat = {
        id: Date.now(), // Use timestamp as ID
        name: groupName,
        created_by: currentUserEmail,
        created_at: new Date().toISOString(),
        members: [
          currentUserEmail,
          ...selectedFriends.map(friend => friend.email)
        ]
      };

      // Save to localStorage
      try {
        const storedGroupChats = localStorage.getItem('groupChats') || '[]';
        const parsedGroupChats = JSON.parse(storedGroupChats);

        // Add the new group chat
        parsedGroupChats.push(newGroupChat);

        // Save back to localStorage
        localStorage.setItem('groupChats', JSON.stringify(parsedGroupChats));
        console.log("Saved new group chat to localStorage:", newGroupChat);
      } catch (storageError) {
        console.error("Error saving to localStorage:", storageError);
      }

      // Send welcome messages to the group chat to make it visible to all members
      // First, send a creation message
      const creationMessage = {
        text: `Created group chat "${groupName}"`,
        sender: currentUserEmail,
        type: "groupchat",
        recipient: `group:${newGroupChat.id}`,
        created_at: new Date().toISOString()
      };

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

      // Then send individual messages for each member (to trigger notifications)
      for (const memberEmail of newGroupChat.members) {
        if (memberEmail === currentUserEmail) continue; // Skip creator

        // Send a message from the creator to establish the group chat
        const addMemberMessage = {
          text: `Added ${memberEmail} to the group chat`,
          sender: currentUserEmail,
          type: "groupchat",
          recipient: `group:${newGroupChat.id}`,
          created_at: new Date(Date.now() + 100).toISOString() // Ensure different timestamp
        };

        try {
          const { error: msgError } = await supabase
            .from("messages")
            .insert([addMemberMessage]);

          if (msgError) {
            console.error(`Error sending add member message for ${memberEmail}:`, msgError);
          }
        } catch (error) {
          console.error(`Error sending add member message for ${memberEmail}:`, error);
        }
      }

      // Success
      setSuccess("Group chat created successfully!");
      setGroupName("");
      setSelectedFriends([]);
      setSearchTerm("");

      // Notify parent component
      if (onGroupChatCreated) {
        onGroupChatCreated(newGroupChat);
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Unexpected error creating group chat:", error);
      setError("An unexpected error occurred");
    }
  };

  return (
    <div className="group-chat-creator">
      <div className="group-chat-creator-header">
        <h2>Create a Group Chat</h2>
      </div>

      <div className="group-chat-creator-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="input-group">
          <label htmlFor="group-name">Group Chat Name</label>
          <input
            id="group-name"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter a name for your group chat"
          />
        </div>

        <div className="input-group">
          <label htmlFor="friend-search">Add Friends</label>
          <div className="search-input-wrapper">
            <input
              id="friend-search"
              type="text"
              value={searchTerm}
              onChange={handleSearchInputChange}
              onFocus={() => setShowDropdown(searchTerm.trim() !== "")}
              placeholder="Search for friends to add"
            />
            {showDropdown && filteredFriends.length > 0 && (
              <div className="friends-dropdown">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.email}
                    className="friend-option"
                    onClick={() => {
                      toggleFriendSelection(friend);
                      setSearchTerm("");
                      setShowDropdown(false);
                    }}
                  >
                    <div className="friend-avatar">
                      {(friend.displayName || friend.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="friend-info">
                      {friend.displayName || friend.email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="selected-friends">
          <h3>Selected Friends ({selectedFriends.length})</h3>
          {selectedFriends.length === 0 ? (
            <div className="no-friends-selected">No friends selected</div>
          ) : (
            <div className="selected-friends-list">
              {selectedFriends.map((friend) => (
                <div key={friend.email} className="selected-friend">
                  <div className="friend-avatar">
                    {(friend.displayName || friend.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="friend-info">
                    {friend.displayName || friend.email}
                  </div>
                  <button
                    className="remove-friend-btn"
                    onClick={() => toggleFriendSelection(friend)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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

export default GroupChatCreator;

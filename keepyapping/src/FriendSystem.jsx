import React, { useState, useEffect } from "react";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/FriendSystem.css";
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function FriendSystem({ currentUserEmail }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [requests, setRequests] = useState([]);
  const [requestError, setRequestError] = useState("");

  const [friends, setFriends] = useState([]);
  const [friendError, setFriendError] = useState("");

  // --- Debug Log ---
  useEffect(() => {
    console.log("CurrentUserEmail passed into FriendSystem:", currentUserEmail);
  }, []);

  // --- Handle Click Outside for Suggestions Dropdown ---
  useEffect(() => {
    function handleClickOutside(event) {
      const searchContainer = document.querySelector('.search-input-wrapper');
      if (searchContainer && !searchContainer.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- Fetch User Suggestions ---
  const fetchUserSuggestions = async (query) => {
    if (!query || query.length < 1) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Fetch users whose display name contains the query string
      const { data, error } = await supabase
        .from("users")
        .select("email, displayname, name, avatar_id")
        .ilike("displayname", `%${query}%`)
        .limit(10); // Fetch more initially, we'll filter some out

      if (error) {
        console.error("Error fetching user suggestions:", error);
        return;
      }

      // Get emails of users with pending requests (both incoming and outgoing)
      const pendingEmails = [
        ...outgoingRequests.map(req => req.receiver_email),
        ...requests.map(req => req.sender_email)
      ];

      // Filter out:
      // 1. The current user
      // 2. Existing friends
      // 3. Users with pending requests
      const filteredSuggestions = data
        .filter(user =>
          user.email !== currentUserEmail &&
          !friends.includes(user.email) &&
          !pendingEmails.includes(user.email) &&
          user.displayname // Only include users with a display name
        );

      setUserSuggestions(filteredSuggestions.slice(0, 5)); // Limit to 5 after filtering
      setShowSuggestions(filteredSuggestions.length > 0);
    } catch (error) {
      console.error("Unexpected error fetching user suggestions:", error);
    }
  };

  // --- Handle Search Input Change ---
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchUserSuggestions(value);
  };

  // --- Select Suggestion ---
  const selectSuggestion = (user) => {
    setSearchTerm(user.displayname);
    setShowSuggestions(false);
    // Automatically search for the selected user
    searchUserByDisplayName(user.displayname);
  };

  // --- Search User ---
  const searchUser = () => {
    if (searchTerm) {
      searchUserByDisplayName(searchTerm);
    } else {
      setSearchError("Please enter a display name to search");
    }
  };

  // --- Search User By Display Name ---
  const searchUserByDisplayName = async (displayName) => {
    setSearchError("");
    setUser(null);

    const { data, error } = await supabase
      .from("users")
      .select("email, name, displayname, avatar_id, custom_avatar_url")
      .eq("displayname", displayName)
      .single();

    if (error) {
      console.error("Search error:", error);
      setSearchError("User not found.");
      return;
    }

    setUser(data);
    setShowSuggestions(false);
  };

  // --- Send Friend Request ---
  const sendFriendRequest = async () => {
    if (!user || !user.email) {
      setSearchError("No user selected.");
      return;
    }

    // Check if they're already friends
    if (friends.includes(user.email)) {
      setSearchError("This user is already your friend.");
      return;
    }

    // Check if a friend request already exists (either sent or received)
    const { data: existingRequests, error: checkError } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(sender_email.eq.${currentUserEmail},receiver_email.eq.${user.email}),` +
        `and(sender_email.eq.${user.email},receiver_email.eq.${currentUserEmail})`
      );

    if (checkError) {
      console.error("Error checking existing friend requests:", checkError);
      setSearchError("Failed to check existing friend requests.");
      return;
    }

    if (existingRequests && existingRequests.length > 0) {
      const request = existingRequests[0];

      // If there's a pending request from the other user to current user
      if (request.sender_email === user.email && request.status === "pending") {
        setSearchError("This user has already sent you a friend request. Check your incoming requests.");
        return;
      }

      // If there's a pending request from current user to the other user
      if (request.sender_email === currentUserEmail && request.status === "pending") {
        setSearchError("You have already sent a friend request to this user.");
        return;
      }

      // If there's a rejected request, delete it and allow sending a new one
      // This allows users to send another friend request after rejection
      if (request.status === "rejected") {
        console.log("Found a rejected request, deleting it to allow a new one");

        // Delete the old rejected request to make way for a new one
        const { error: deleteError } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", request.id);

        if (deleteError) {
          console.error("Error deleting old rejected request:", deleteError);
          setSearchError("Failed to process friend request. Please try again.");
          return;
        }
      }
    }

    // If we get here, it's safe to send a new friend request
    const { error } = await supabase.from("friend_requests").insert([
      {
        sender_email: currentUserEmail,
        receiver_email: user.email,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("Error sending friend request:", error);
      setSearchError("Failed to send friend request.");
      return;
    }

    alert("Friend request sent!");
    setUser(null); // clear search result
    setSearchTerm(""); // clear input

    // Refresh outgoing requests
    fetchOutgoingRequests();
  };

  // --- Fetch Friend Requests ---
  const fetchFriendRequests = async () => {
    console.log("Fetching requests for:", currentUserEmail);

    // Check if currentUserEmail is valid
    if (!currentUserEmail) {
      console.error("No user email provided to FriendSystem");
      setRequestError("Error: No user email available. Please log in again.");
      return;
    }

    try {
      // Log the query parameters for debugging
      console.log("Friend request query parameters:", {
        receiver_email: currentUserEmail,
        status: "pending"
      });

      // Get pending friend requests
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("receiver_email", currentUserEmail) // case-insensitive match
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching friend requests:", error);
        setRequestError(`Database error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Friend request data from Supabase:", requestsData);

      // Check if data is null or undefined
      if (!requestsData) {
        setRequestError("Warning: No data returned from the database.");
        setRequests([]);
        return;
      }

      // Check if data is empty
      if (requestsData.length === 0) {
        console.log("No pending friend requests found for user:", currentUserEmail);
        setRequestError(""); // Clear any previous errors
        setRequests([]);
        return;
      } else {
        console.log(`Found ${requestsData.length} pending friend requests`);
        setRequestError(""); // Clear any previous errors
      }

      // Fetch display names for all senders
      const senderEmails = requestsData.map(req => req.sender_email);
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id, custom_avatar_url")
        .in("email", senderEmails);

      if (usersError) {
        console.error("Error fetching user display names:", usersError);
        setRequests(requestsData); // Fall back to using just the request data
        return;
      }

      // Create maps for display name, avatar ID, and custom avatar URL
      const displayNameMap = {};
      const avatarIdMap = {};
      const customAvatarMap = {};
      usersData.forEach(user => {
        displayNameMap[user.email] = user.displayname || user.email;
        avatarIdMap[user.email] = user.avatar_id || 1; // Default to 1 if not set

        // Store custom avatar URL if it exists and avatar_id is CUSTOM_AVATAR_ID
        if (user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url) {
          customAvatarMap[user.email] = user.custom_avatar_url;
        }
      });

      // Enhance the request data with display names, avatar IDs, and custom avatar URLs
      const enhancedRequests = requestsData.map(req => ({
        ...req,
        sender_display_name: displayNameMap[req.sender_email] || req.sender_email,
        sender_avatar_id: avatarIdMap[req.sender_email] || 1,
        sender_custom_avatar_url: customAvatarMap[req.sender_email] || null
      }));

      setRequests(enhancedRequests);
    } catch (unexpectedError) {
      console.error("Unexpected error in fetchFriendRequests:", unexpectedError);
      setRequestError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // --- Accept / Reject Friend Request ---
  const respondToRequest = async (requestId, status) => {
    if (!requestId) {
      console.error("No request ID provided to respondToRequest");
      setRequestError("Error: Missing request ID");
      return;
    }

    try {
      console.log(`Responding to friend request ${requestId} with status: ${status}`);

      // Just update the status
      // When status is "rejected", the sender will be able to send another request later
      // This is handled in the sendFriendRequest function which deletes rejected requests
      const updateData = { status };

      const { error } = await supabase
        .from("friend_requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) {
        console.error("Error responding to friend request:", error);
        setRequestError(`Failed to ${status === "accepted" ? "accept" : "reject"} friend request: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log(`Successfully updated request ${requestId} to ${status}`);

      // Show a temporary success message
      setRequestError(`Successfully ${status === "accepted" ? "accepted" : "rejected"} the friend request!`);

      // Clear the success message after 3 seconds
      setTimeout(() => {
        setRequestError("");
      }, 3000);

      // Refresh the data
      fetchFriendRequests();
      fetchFriends();
    } catch (unexpectedError) {
      console.error("Unexpected error in respondToRequest:", unexpectedError);
      setRequestError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // --- Remove Friend ---
  const removeFriend = async (friendEmail) => {
    if (!currentUserEmail || !friendEmail) {
      console.error("Missing user email or friend email");
      setFriendError("Error: Missing user information");
      return;
    }

    // Get the display name if available
    let displayName = friendEmail;
    const friendObj = friends.find(f => typeof f === 'object' && f.email === friendEmail);
    if (friendObj && friendObj.displayName) {
      displayName = friendObj.displayName;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to remove ${displayName} from your friends list?`);
    if (!confirmed) {
      return; // User cancelled the operation
    }

    try {
      console.log(`Removing friend: ${friendEmail} (${displayName})`);

      // Find the friend request record(s) between these two users
      const { data, error: fetchError } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`and(sender_email.eq.${currentUserEmail},receiver_email.eq.${friendEmail}),and(sender_email.eq.${friendEmail},receiver_email.eq.${currentUserEmail})`)
        .eq("status", "accepted");

      if (fetchError) {
        console.error("Error finding friend request:", fetchError);
        setFriendError(`Failed to find friend record: ${fetchError.message || fetchError.details || "Unknown error"}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error("No friend record found between", currentUserEmail, "and", friendEmail);
        setFriendError("Error: Friend record not found");
        return;
      }

      // Delete the friend request record(s)
      for (const record of data) {
        const { error: deleteError } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", record.id);

        if (deleteError) {
          console.error("Error deleting friend request:", deleteError);
          setFriendError(`Failed to remove friend: ${deleteError.message || deleteError.details || "Unknown error"}`);
          return;
        }
      }

      console.log(`Successfully removed friend: ${displayName}`);

      // Show a temporary success message
      setFriendError(`Successfully removed ${displayName} from your friends list!`);
      setTimeout(() => {
        setFriendError("");
      }, 3000);

      // Refresh the data
      fetchFriends();
    } catch (unexpectedError) {
      console.error("Unexpected error in removeFriend:", unexpectedError);
      setFriendError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // --- Fetch Accepted Friends ---
  const fetchFriends = async () => {
    // Check if currentUserEmail is valid
    if (!currentUserEmail) {
      console.error("No user email provided to fetchFriends");
      setFriendError("Error: No user email available. Please log in again.");
      return;
    }

    try {
      console.log("Fetching accepted friends for:", currentUserEmail);

      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
        .eq("status", "accepted");

      if (error) {
        console.error("Error fetching friends:", error);
        setFriendError(`Database error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      // Check if data is null or undefined
      if (!requestsData) {
        console.error("No data returned when fetching friends");
        setFriendError("Warning: No data returned from the database.");
        setFriends([]);
        return;
      }

      console.log("Accepted friends data from Supabase:", requestsData);

      // Check if data is empty
      if (requestsData.length === 0) {
        console.log("No accepted friends found for user:", currentUserEmail);
        setFriendError(""); // Clear any previous errors
        setFriends([]);
        return;
      }

      try {
        // Extract friend emails
        const friendEmails = requestsData.map((req) =>
          req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
        );

        // Fetch display names and avatar IDs for all friends
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("email, displayname, avatar_id, custom_avatar_url")
          .in("email", friendEmails);

        if (usersError) {
          console.error("Error fetching friend display names:", usersError);
          // Fall back to just using emails
          setFriends(friendEmails);
          setFriendError("");
          return;
        }

        // Create maps for display name, avatar ID, and custom avatar URL
        const displayNameMap = {};
        const avatarIdMap = {};
        const customAvatarMap = {};
        usersData.forEach(user => {
          displayNameMap[user.email] = user.displayname || user.email;
          avatarIdMap[user.email] = user.avatar_id || 1; // Default to 1 if not set

          // Store custom avatar URL if it exists and avatar_id is CUSTOM_AVATAR_ID
          if (user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url) {
            customAvatarMap[user.email] = user.custom_avatar_url;
          }
        });

        // Store custom avatar URLs in localStorage for easy access across components
        localStorage.setItem('friendCustomAvatars', JSON.stringify(customAvatarMap));

        // Create enhanced friend objects with email, display name, and avatar ID
        const enhancedFriends = friendEmails.map(email => ({
          email: email,
          displayName: displayNameMap[email] || email,
          avatarId: avatarIdMap[email] || 1
        }));

        console.log("Processed friend list with display names:", enhancedFriends);
        setFriends(enhancedFriends);
        setFriendError("");
      } catch (mapError) {
        console.error("Error processing friend data:", mapError);
        setFriendError(`Error processing friend data: ${mapError.message || "Unknown error"}`);
        setFriends([]);
      }
    } catch (unexpectedError) {
      console.error("Unexpected error in fetchFriends:", unexpectedError);
      setFriendError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // --- Load on mount and when currentUserEmail changes ---
  useEffect(() => {
    console.log("FriendSystem useEffect triggered with currentUserEmail:", currentUserEmail);

    if (!currentUserEmail) {
      console.log("No currentUserEmail available, skipping data fetch");
      return;
    }

    // Fetch all types of friend data
    fetchFriendRequests();
    fetchFriends();
    fetchOutgoingRequests();

    // Set up periodic refresh for friend data
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of friend data in FriendSystem");
      fetchFriendRequests();
      fetchFriends();
      fetchOutgoingRequests();
    }, 5000); // Refresh every 5 seconds

    // Create unique channel names for this user
    const userPrefix = currentUserEmail.replace(/[^a-zA-Z0-9]/g, '');

    // Set up real-time subscription for incoming friend requests
    const incomingRequestsSub = supabase
      .channel(`incoming-requests-${userPrefix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_email=eq.${currentUserEmail}`
        },
        (payload) => {
          console.log("Incoming friend request change detected:", payload);
          fetchFriendRequests();
          fetchFriends();
        }
      )
      .subscribe();

    // Set up real-time subscription for outgoing friend requests
    const outgoingRequestsSub = supabase
      .channel(`outgoing-requests-${userPrefix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `sender_email=eq.${currentUserEmail}`
        },
        (payload) => {
          console.log("Outgoing friend request change detected:", payload);
          fetchOutgoingRequests();
          fetchFriends();
        }
      )
      .subscribe();

    console.log("Supabase real-time subscriptions set up for friend requests");

    return () => {
      console.log("Cleaning up Supabase subscriptions and interval");
      clearInterval(refreshInterval);
      supabase.removeChannel(incomingRequestsSub);
      supabase.removeChannel(outgoingRequestsSub);
    };
  }, [currentUserEmail]); // Re-run when currentUserEmail changes

  // States for friend management
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [outgoingRequestsError, setOutgoingRequestsError] = useState("");



  // Function to fetch outgoing friend requests
  const fetchOutgoingRequests = async () => {
    if (!currentUserEmail) {
      setOutgoingRequestsError("No user email available");
      return;
    }

    try {
      console.log("Fetching outgoing friend requests for:", currentUserEmail);

      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("sender_email", currentUserEmail)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching outgoing requests:", error);
        setOutgoingRequestsError(`Error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Outgoing friend requests:", requestsData);

      if (!requestsData || requestsData.length === 0) {
        setOutgoingRequests([]);
        setOutgoingRequestsError("");
        return;
      }

      // Fetch display names for all receivers
      const receiverEmails = requestsData.map(req => req.receiver_email);
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id")
        .in("email", receiverEmails);

      if (usersError) {
        console.error("Error fetching user display names:", usersError);
        setOutgoingRequests(requestsData); // Fall back to using just the request data
        return;
      }

      // Create maps for display name and avatar ID
      const displayNameMap = {};
      const avatarIdMap = {};
      usersData.forEach(user => {
        displayNameMap[user.email] = user.displayname || user.email;
        avatarIdMap[user.email] = user.avatar_id || 1; // Default to 1 if not set
      });

      // Enhance the request data with display names and avatar IDs
      const enhancedRequests = requestsData.map(req => ({
        ...req,
        receiver_display_name: displayNameMap[req.receiver_email] || req.receiver_email,
        receiver_avatar_id: avatarIdMap[req.receiver_email] || 1
      }));

      setOutgoingRequests(enhancedRequests);
      setOutgoingRequestsError("");
    } catch (error) {
      console.error("Unexpected error fetching outgoing requests:", error);
      setOutgoingRequestsError(`Unexpected error: ${error.message || "Unknown error"}`);
    }
  };



  return (
    <div className="friend-system">
      <div className="friend-system-header">
        <h2>Friend System</h2>
      </div>

      <div className="friend-system-content">
        {/* Search Section */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Add Friend</h3>
          </div>

          <div className="search-container">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Enter a user's display name"
                value={searchTerm}
                onChange={handleSearchInputChange}
                onFocus={() => searchTerm.length > 0 && setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicking on them
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {showSuggestions && userSuggestions.length > 0 && (
                <div className="email-suggestions">
                  {userSuggestions.map((user, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => selectSuggestion(user)}
                    >
                      <span className="suggestion-display-name">{user.displayname}</span>
                      <span className="suggestion-email">({user.email})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={searchUser}>Search</button>
          </div>

          {searchError && <div className="error-message">{searchError}</div>}

          {user && (
            <div className="friend-item">
              <div className="friend-avatar">
                {user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url ? (
                  <img
                    src={user.custom_avatar_url}
                    alt={user.displayname || user.email}
                  />
                ) : user.avatar_id ? (
                  <img
                    src={avatars.find(a => a.id === user.avatar_id)?.url || avatars[0].url}
                    alt={user.displayname || user.email}
                  />
                ) : (
                  user.displayname ? user.displayname.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                )}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {user.name || user.email} {user.displayname && `(${user.displayname})`}
                </div>
                <div className="friend-status">Found user</div>
              </div>
              <div className="friend-actions">
                {/* Check if this is the current user */}
                {user.email === currentUserEmail ? (
                  <div className="friend-status-message">This is you</div>
                ) : (
                  /* Check if they're already friends */
                  friends.includes(user.email) ? (
                    <div className="friend-status-message">Already friends</div>
                  ) : (
                    /* Check if there's a pending outgoing request */
                    outgoingRequests.some(req => req.receiver_email === user.email) ? (
                      <div className="friend-status-message">Request pending</div>
                    ) : (
                      /* Check if there's a pending incoming request */
                      requests.some(req => req.sender_email === user.email) ? (
                        <div className="friend-status-message">Request received</div>
                      ) : (
                        /* Otherwise, show the Add Friend button */
                        <button className="btn btn-success" onClick={sendFriendRequest}>
                          Send Friend Request
                        </button>
                      )
                    )
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Incoming Friend Requests</h3>
          </div>

          {requestError && (
            <div className={requestError.includes("Successfully") ? "success-message" : "error-message"}>
              {requestError}
            </div>
          )}

          {requests.length === 0 && !requestError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">No incoming friend requests</div>
              </div>
            </div>
          )}

          {requests.map((req) => (
            <div key={req.id} className="friend-item">
              <div className="friend-avatar">
                {req.sender_avatar_id === CUSTOM_AVATAR_ID && req.sender_custom_avatar_url ? (
                  <img
                    src={req.sender_custom_avatar_url}
                    alt={req.sender_display_name || req.sender_email}
                  />
                ) : req.sender_avatar_id ? (
                  <img
                    src={avatars.find(a => a.id === req.sender_avatar_id)?.url || avatars[0].url}
                    alt={req.sender_display_name || req.sender_email}
                  />
                ) : (
                  (req.sender_display_name || req.sender_email).charAt(0).toUpperCase()
                )}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {req.sender_display_name || req.sender_email}
                  {req.sender_display_name && req.sender_display_name !== req.sender_email && (
                    <span className="friend-email">({req.sender_email})</span>
                  )}
                </div>
                <div className="friend-status">Wants to add you as a friend</div>
              </div>
              <div className="friend-actions">
                <button
                  className="btn btn-success"
                  onClick={() => respondToRequest(req.id, "accepted")}
                >
                  Accept
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => respondToRequest(req.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Outgoing Requests */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Outgoing Friend Requests</h3>
          </div>

          {outgoingRequestsError && (
            <div className="warning-message">
              {outgoingRequestsError}
            </div>
          )}

          {outgoingRequests.length === 0 && !outgoingRequestsError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">No outgoing friend requests</div>
              </div>
            </div>
          )}

          {outgoingRequests.map((req) => (
            <div key={req.id} className="friend-item">
              <div className="friend-avatar">
                {req.receiver_avatar_id ? (
                  <img
                    src={avatars.find(a => a.id === req.receiver_avatar_id)?.url || avatars[0].url}
                    alt={req.receiver_display_name || req.receiver_email}
                  />
                ) : (
                  (req.receiver_display_name || req.receiver_email).charAt(0).toUpperCase()
                )}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {req.receiver_display_name || req.receiver_email}
                  {req.receiver_display_name && req.receiver_display_name !== req.receiver_email && (
                    <span className="friend-email">({req.receiver_email})</span>
                  )}
                </div>
                <div className="friend-status">Request pending</div>
              </div>
            </div>
          ))}
        </div>

        {/* Friends List */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Delete Friends</h3>
          </div>

          {friendError && (
            <div className="error-message">
              {friendError}
            </div>
          )}

          {friends.length === 0 && !friendError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">You have no friends yet</div>
              </div>
            </div>
          )}

          {friends.map((friend) => (
            <div key={typeof friend === 'object' ? friend.email : friend} className="friend-item">
              <div className="friend-avatar">
                {typeof friend === 'object' && friend.avatarId === CUSTOM_AVATAR_ID ? (
                  // Get custom avatar URL from localStorage
                  <img
                    src={JSON.parse(localStorage.getItem('friendCustomAvatars') || '{}')[friend.email]}
                    alt={friend.displayName || friend.email}
                  />
                ) : typeof friend === 'object' && friend.avatarId ? (
                  <img
                    src={avatars.find(a => a.id === friend.avatarId)?.url || avatars[0].url}
                    alt={friend.displayName || friend.email}
                  />
                ) : (
                  typeof friend === 'object'
                    ? (friend.displayName || friend.email).charAt(0).toUpperCase()
                    : friend.charAt(0).toUpperCase()
                )}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {typeof friend === 'object'
                    ? friend.displayName || friend.email
                    : friend}
                  {typeof friend === 'object' && friend.displayName && friend.displayName !== friend.email && (
                    <span className="friend-email">({friend.email})</span>
                  )}
                </div>
                <div className="friend-status">Online</div>
              </div>
              <div className="friend-actions">
                <button
                  className="btn btn-danger btn-remove-friend"
                  onClick={() => removeFriend(typeof friend === 'object' ? friend.email : friend)}
                  title="Remove friend"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>


      </div>
    </div>
  );
}

export default FriendSystem;

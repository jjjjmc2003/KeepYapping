// Import React and its hooks for building the component
import React, { useState, useEffect } from "react";
// Import Supabase client for database operations
import * as SupabaseClient from "@supabase/supabase-js";
// Import CSS styles for the friend system
import "../styles/FriendSystem.css";
// Import avatar images and the special ID for custom avatars
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";

// Connection details for our Supabase database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Create a Supabase client we'll use throughout the component
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Main component for managing friends - searching, adding, and removing friends
function FriendSystem({ currentUserEmail }) {
  // State for the friend search feature
  const [searchTerm, setSearchTerm] = useState(""); // What the user types in the search box
  const [user, setUser] = useState(null); // The user found by the search
  const [searchError, setSearchError] = useState(""); // Any errors during search
  const [userSuggestions, setUserSuggestions] = useState([]); // Autocomplete suggestions
  const [showSuggestions, setShowSuggestions] = useState(false); // Whether to show suggestions dropdown

  // State for incoming friend requests
  const [requests, setRequests] = useState([]); // List of friend requests received
  const [requestError, setRequestError] = useState(""); // Any errors with friend requests

  // State for the friends list
  const [friends, setFriends] = useState([]); // List of current friends
  const [friendError, setFriendError] = useState(""); // Any errors with the friends list

  // Note: outgoingRequests state is declared later in the file

  // Log the current user email when the component first loads
  useEffect(() => {
    console.log("CurrentUserEmail passed into FriendSystem:", currentUserEmail);
  }, []); // Empty dependency array means this runs once on mount

  // Close the suggestions dropdown when clicking outside of it
  useEffect(() => {
    // Function to handle clicks anywhere in the document
    function handleClickOutside(event) {
      // Find the search input container element
      const searchContainer = document.querySelector('.search-input-wrapper');
      // If we found the container and the click was outside it
      if (searchContainer && !searchContainer.contains(event.target)) {
        // Hide the suggestions dropdown
        setShowSuggestions(false);
      }
    }

    // Add the click handler to the entire document
    document.addEventListener('mousedown', handleClickOutside);

    // Return a cleanup function that removes the event listener
    // This prevents memory leaks when the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // Empty dependency array means this runs once on mount

  // Get user suggestions for the autocomplete dropdown as the user types
  const fetchUserSuggestions = async (query) => {
    // If the query is empty, clear suggestions and hide the dropdown
    if (!query || query.length < 1) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Search the database for users whose display name contains the query text
      const { data, error } = await supabase
        .from("users")
        .select("email, displayname, name, avatar_id")
        .ilike("displayname", `%${query}%`) // Case-insensitive partial match
        .limit(10); // Get up to 10 matches initially

      // Handle any database errors
      if (error) {
        console.error("Error fetching user suggestions:", error);
        return;
      }

      // Create a list of emails that should be excluded from suggestions:
      // - Users who have sent you a friend request
      // - Users you've sent a friend request to
      const pendingEmails = [
        ...outgoingRequests.map(req => req.receiver_email), // People you've sent requests to
        ...requests.map(req => req.sender_email) // People who've sent you requests
      ];

      // Filter the suggestions to remove:
      // 1. The current user (can't friend yourself)
      // 2. People who are already your friends
      // 3. People with pending friend requests
      // 4. Users without a display name
      const filteredSuggestions = data
        .filter(user =>
          user.email !== currentUserEmail && // Not the current user
          !friends.includes(user.email) && // Not already a friend
          !pendingEmails.includes(user.email) && // No pending requests
          user.displayname // Has a display name
        );

      // Update state with the filtered suggestions (limit to 5 for UI)
      setUserSuggestions(filteredSuggestions.slice(0, 5));
      // Only show the dropdown if we have suggestions
      setShowSuggestions(filteredSuggestions.length > 0);
    } catch (error) {
      console.error("Unexpected error fetching user suggestions:", error);
    }
  };

  // Handle when the user types in the search box
  const handleSearchInputChange = (e) => {
    const value = e.target.value; // Get what the user typed
    setSearchTerm(value); // Update the search term state
    fetchUserSuggestions(value); // Get autocomplete suggestions based on what they typed
  };

  // Handle when the user clicks on a suggestion from the dropdown
  const selectSuggestion = (user) => {
    setSearchTerm(user.displayname); // Fill the search box with the selected name
    setShowSuggestions(false); // Hide the suggestions dropdown
    // Automatically search for the selected user (no need to click search button)
    searchUserByDisplayName(user.displayname);
  };

  // Handle when the user clicks the search button
  const searchUser = () => {
    if (searchTerm) {
      // If there's text in the search box, search for that user
      searchUserByDisplayName(searchTerm);
    } else {
      // If the search box is empty, show an error
      setSearchError("Please enter a display name to search");
    }
  };

  // Search for a user by their display name in the database
  const searchUserByDisplayName = async (displayName) => {
    // Clear any previous errors and search results
    setSearchError("");
    setUser(null);

    // Search the database for a user with this exact display name
    const { data, error } = await supabase
      .from("users")
      .select("email, name, displayname, avatar_id, custom_avatar_url")
      .eq("displayname", displayName) // Exact match on display name
      .single(); // We only want one result

    // If there was an error or no user found
    if (error) {
      console.error("Search error:", error);
      setSearchError("User not found.");
      return;
    }

    // Store the found user in state
    setUser(data);
    // Hide the suggestions dropdown
    setShowSuggestions(false);
  };

  // Send a friend request to the user found in the search
  const sendFriendRequest = async () => {
    // Make sure we have a valid user selected
    if (!user || !user.email) {
      setSearchError("No user selected.");
      return;
    }

    // Check if they're already friends
    if (friends.includes(user.email)) {
      setSearchError("This user is already your friend.");
      return;
    }

    // Check if a friend request already exists between these users
    // We need to check both directions (sent and received)
    const { data: existingRequests, error: checkError } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        // Check for requests from current user to the found user
        `and(sender_email.eq.${currentUserEmail},receiver_email.eq.${user.email}),` +
        // Check for requests from the found user to the current user
        `and(sender_email.eq.${user.email},receiver_email.eq.${currentUserEmail})`
      );

    // Handle any errors checking for existing requests
    if (checkError) {
      console.error("Error checking existing friend requests:", checkError);
      setSearchError("Failed to check existing friend requests.");
      return;
    }

    // If we found any existing requests between these users
    if (existingRequests && existingRequests.length > 0) {
      const request = existingRequests[0];

      // Case 1: They already sent you a request that's pending
      if (request.sender_email === user.email && request.status === "pending") {
        setSearchError("This user has already sent you a friend request. Check your incoming requests.");
        return;
      }

      // Case 2: You already sent them a request that's pending
      if (request.sender_email === currentUserEmail && request.status === "pending") {
        setSearchError("You have already sent a friend request to this user.");
        return;
      }

      // Case 3: There was a rejected request in the past
      // We'll delete it so they can try again
      if (request.status === "rejected") {
        console.log("Found a rejected request, deleting it to allow a new one");

        // Delete the old rejected request
        const { error: deleteError } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", request.id);

        // Handle any errors deleting the old request
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
        sender_email: currentUserEmail, // From the current user
        receiver_email: user.email,     // To the found user
        status: "pending",              // Initial status is pending
      },
    ]);

    // Handle any errors sending the request
    if (error) {
      console.error("Error sending friend request:", error);
      setSearchError("Failed to send friend request.");
      return;
    }

    // Success! Show a confirmation and reset the form
    alert("Friend request sent!");
    setUser(null);      // Clear the search result
    setSearchTerm(""); // Clear the search input

    // Refresh the list of outgoing requests to include this new one
    fetchOutgoingRequests();
  };

  // Fetch all incoming friend requests for the current user
  const fetchFriendRequests = async () => {
    console.log("Fetching requests for:", currentUserEmail);

    // Make sure we have a valid user email
    if (!currentUserEmail) {
      console.error("No user email provided to FriendSystem");
      setRequestError("Error: No user email available. Please log in again.");
      return;
    }

    try {
      // Log what we're about to query for debugging
      console.log("Friend request query parameters:", {
        receiver_email: currentUserEmail,
        status: "pending"
      });

      // Get all pending friend requests where the current user is the receiver
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("receiver_email", currentUserEmail) // Case-insensitive match on email
        .eq("status", "pending"); // Only get pending requests (not accepted/rejected)

      // Handle any database errors
      if (error) {
        console.error("Error fetching friend requests:", error);
        setRequestError(`Database error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Friend request data from Supabase:", requestsData);

      // Handle case where no data was returned
      if (!requestsData) {
        setRequestError("Warning: No data returned from the database.");
        setRequests([]);
        return;
      }

      // Handle case where no friend requests were found
      if (requestsData.length === 0) {
        console.log("No pending friend requests found for user:", currentUserEmail);
        setRequestError(""); // Clear any previous errors
        setRequests([]);
        return;
      } else {
        // We found some friend requests
        console.log(`Found ${requestsData.length} pending friend requests`);
        setRequestError(""); // Clear any previous errors
      }

      // Get display names and avatars for all the users who sent requests
      // This makes the UI more friendly by showing names instead of just emails
      const senderEmails = requestsData.map(req => req.sender_email);
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id, custom_avatar_url")
        .in("email", senderEmails); // Get all these users in one query

      // Handle errors getting user details
      if (usersError) {
        console.error("Error fetching user display names:", usersError);
        setRequests(requestsData); // Fall back to using just the request data without names
        return;
      }

      // Create lookup maps for user details to make it easier to find them
      const displayNameMap = {}; // Maps email to display name
      const avatarIdMap = {};    // Maps email to avatar ID
      const customAvatarMap = {}; // Maps email to custom avatar URL

      // Fill the lookup maps with data from the users query
      usersData.forEach(user => {
        displayNameMap[user.email] = user.displayname || user.email;
        avatarIdMap[user.email] = user.avatar_id || 1; // Default to avatar 1 if not set

        // Store custom avatar URL if this user has a custom avatar
        if (user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url) {
          customAvatarMap[user.email] = user.custom_avatar_url;
        }
      });

      // Enhance each friend request with the sender's display name and avatar
      const enhancedRequests = requestsData.map(req => ({
        ...req, // Keep all the original request data
        // Add display name (fall back to email if no display name)
        sender_display_name: displayNameMap[req.sender_email] || req.sender_email,
        // Add avatar ID (default to 1 if not found)
        sender_avatar_id: avatarIdMap[req.sender_email] || 1,
        // Add custom avatar URL (null if not found)
        sender_custom_avatar_url: customAvatarMap[req.sender_email] || null
      }));

      // Update state with the enhanced friend requests
      setRequests(enhancedRequests);
    } catch (unexpectedError) {
      // Handle any unexpected errors
      console.error("Unexpected error in fetchFriendRequests:", unexpectedError);
      setRequestError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // Handle accepting or rejecting a friend request
  const respondToRequest = async (requestId, status) => {
    // Make sure we have a valid request ID
    if (!requestId) {
      console.error("No request ID provided to respondToRequest");
      setRequestError("Error: Missing request ID");
      return;
    }

    try {
      console.log(`Responding to friend request ${requestId} with status: ${status}`);

      // We just need to update the status field in the database
      // - "accepted" means you're now friends
      // - "rejected" means you declined the request
      // When status is "rejected", the sender can send another request later
      // (This is handled in the sendFriendRequest function which deletes rejected requests)
      const updateData = { status };

      // Update the friend request in the database
      const { error } = await supabase
        .from("friend_requests")
        .update(updateData)
        .eq("id", requestId);

      // Handle any errors updating the request
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

      // Refresh the lists to show the changes
      fetchFriendRequests(); // Update the incoming requests list
      fetchFriends();       // Update the friends list if accepted
    } catch (unexpectedError) {
      // Handle any unexpected errors
      console.error("Unexpected error in respondToRequest:", unexpectedError);
      setRequestError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // Remove someone from your friends list
  const removeFriend = async (friendEmail) => {
    // Make sure we have both emails needed
    if (!currentUserEmail || !friendEmail) {
      console.error("Missing user email or friend email");
      setFriendError("Error: Missing user information");
      return;
    }

    // Try to get the friend's display name for a more friendly message
    let displayName = friendEmail; // Default to using the email
    // Look for this friend in our friends list
    const friendObj = friends.find(f => typeof f === 'object' && f.email === friendEmail);
    if (friendObj && friendObj.displayName) {
      displayName = friendObj.displayName; // Use display name if available
    }

    // Ask the user to confirm before removing the friend
    const confirmed = window.confirm(`Are you sure you want to remove ${displayName} from your friends list?`);
    if (!confirmed) {
      return; // User cancelled the operation, do nothing
    }

    try {
      console.log(`Removing friend: ${friendEmail} (${displayName})`);

      // Find the friend request record that connects these two users
      // We need to check both directions (who sent the original request)
      const { data, error: fetchError } = await supabase
        .from("friend_requests")
        .select("*")
        .or(
          // Either current user sent to friend
          `and(sender_email.eq.${currentUserEmail},receiver_email.eq.${friendEmail}),` +
          // Or friend sent to current user
          `and(sender_email.eq.${friendEmail},receiver_email.eq.${currentUserEmail})`
        )
        .eq("status", "accepted"); // Only look at accepted friend requests

      // Handle errors finding the friend record
      if (fetchError) {
        console.error("Error finding friend request:", fetchError);
        setFriendError(`Failed to find friend record: ${fetchError.message || fetchError.details || "Unknown error"}`);
        return;
      }

      // Handle case where no friend record was found
      if (!data || data.length === 0) {
        console.error("No friend record found between", currentUserEmail, "and", friendEmail);
        setFriendError("Error: Friend record not found");
        return;
      }

      // Delete all friend request records between these users
      // (There should only be one, but we loop just in case)
      for (const record of data) {
        const { error: deleteError } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", record.id);

        // Handle errors deleting the record
        if (deleteError) {
          console.error("Error deleting friend request:", deleteError);
          setFriendError(`Failed to remove friend: ${deleteError.message || deleteError.details || "Unknown error"}`);
          return;
        }
      }

      console.log(`Successfully removed friend: ${displayName}`);

      // Show a temporary success message
      setFriendError(`Successfully removed ${displayName} from your friends list!`);
      // Clear the message after 3 seconds
      setTimeout(() => {
        setFriendError("");
      }, 3000);

      // Refresh the friends list to show the change
      fetchFriends();
    } catch (unexpectedError) {
      // Handle any unexpected errors
      console.error("Unexpected error in removeFriend:", unexpectedError);
      setFriendError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // Fetch the list of all accepted friends for the current user
  const fetchFriends = async () => {
    // Make sure we have a valid user email
    if (!currentUserEmail) {
      console.error("No user email provided to fetchFriends");
      setFriendError("Error: No user email available. Please log in again.");
      return;
    }

    try {
      console.log("Fetching accepted friends for:", currentUserEmail);

      // Get all accepted friend requests where the current user is either sender or receiver
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
        .eq("status", "accepted"); // Only get accepted requests (these are actual friends)

      // Handle any database errors
      if (error) {
        console.error("Error fetching friends:", error);
        setFriendError(`Database error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      // Handle case where no data was returned
      if (!requestsData) {
        console.error("No data returned when fetching friends");
        setFriendError("Warning: No data returned from the database.");
        setFriends([]);
        return;
      }

      console.log("Accepted friends data from Supabase:", requestsData);

      // Handle case where user has no friends
      if (requestsData.length === 0) {
        console.log("No accepted friends found for user:", currentUserEmail);
        setFriendError(""); // Clear any previous errors
        setFriends([]);
        return;
      }

      try {
        // For each friend request, get the email of the other person
        // (not the current user)
        const friendEmails = requestsData.map((req) =>
          req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
        );

        // Get display names and avatars for all friends
        // This makes the UI more friendly by showing names instead of just emails
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("email, displayname, avatar_id, custom_avatar_url")
          .in("email", friendEmails); // Get all these users in one query

        // Handle errors getting user details
        if (usersError) {
          console.error("Error fetching friend display names:", usersError);
          // Fall back to just using emails without display names
          setFriends(friendEmails);
          setFriendError("");
          return;
        }

        // Create lookup maps for user details to make it easier to find them
        const displayNameMap = {}; // Maps email to display name
        const avatarIdMap = {};    // Maps email to avatar ID
        const customAvatarMap = {}; // Maps email to custom avatar URL

        // Fill the lookup maps with data from the users query
        usersData.forEach(user => {
          displayNameMap[user.email] = user.displayname || user.email;
          avatarIdMap[user.email] = user.avatar_id || 1; // Default to avatar 1 if not set

          // Store custom avatar URL if this user has a custom avatar
          if (user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url) {
            customAvatarMap[user.email] = user.custom_avatar_url;
          }
        });

        // Store custom avatar URLs in localStorage so other components can use them
        localStorage.setItem('friendCustomAvatars', JSON.stringify(customAvatarMap));

        // Create enhanced friend objects with email, display name, and avatar ID
        const enhancedFriends = friendEmails.map(email => ({
          email: email,                              // The friend's email
          displayName: displayNameMap[email] || email, // Their display name (or email if none)
          avatarId: avatarIdMap[email] || 1          // Their avatar ID (or default if none)
        }));

        console.log("Processed friend list with display names:", enhancedFriends);
        // Update state with the enhanced friends list
        setFriends(enhancedFriends);
        setFriendError(""); // Clear any previous errors
      } catch (mapError) {
        // Handle errors processing the friend data
        console.error("Error processing friend data:", mapError);
        setFriendError(`Error processing friend data: ${mapError.message || "Unknown error"}`);
        setFriends([]);
      }
    } catch (unexpectedError) {
      // Handle any unexpected errors
      console.error("Unexpected error in fetchFriends:", unexpectedError);
      setFriendError(`Unexpected error: ${unexpectedError.message || "Unknown error occurred"}`);
    }
  };

  // Main effect that loads data and sets up real-time updates
  // This runs when the component mounts and whenever the current user changes
  useEffect(() => {
    console.log("FriendSystem useEffect triggered with currentUserEmail:", currentUserEmail);

    // Don't do anything if we don't have a user email
    if (!currentUserEmail) {
      console.log("No currentUserEmail available, skipping data fetch");
      return;
    }

    // Load initial data for all three sections
    fetchFriendRequests();  // Incoming friend requests
    fetchFriends();         // Current friends
    fetchOutgoingRequests(); // Outgoing friend requests

    // Set up a timer to refresh the data periodically
    // This ensures the UI stays up-to-date even if real-time updates fail
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of friend data in FriendSystem");
      fetchFriendRequests();
      fetchFriends();
      fetchOutgoingRequests();
    }, 5000); // Refresh every 5 seconds

    // Create a unique prefix for channel names based on the user's email
    // This prevents conflicts with other users' channels
    const userPrefix = currentUserEmail.replace(/[^a-zA-Z0-9]/g, '');

    // Set up real-time subscription for incoming friend requests
    // This will update the UI immediately when someone sends you a request
    const incomingRequestsSub = supabase
      .channel(`incoming-requests-${userPrefix}`)
      .on(
        "postgres_changes", // Listen for database changes
        {
          event: "*",                // Any event (insert, update, delete)
          schema: "public",          // In the public schema
          table: "friend_requests",  // On the friend_requests table
          filter: `receiver_email=eq.${currentUserEmail}` // Where you're the receiver
        },
        (payload) => {
          // When a change is detected, refresh the relevant data
          console.log("Incoming friend request change detected:", payload);
          fetchFriendRequests(); // Refresh incoming requests
          fetchFriends();        // Refresh friends list (in case a request was accepted)
        }
      )
      .subscribe();

    // Set up real-time subscription for outgoing friend requests
    // This will update the UI immediately when someone responds to your request
    const outgoingRequestsSub = supabase
      .channel(`outgoing-requests-${userPrefix}`)
      .on(
        "postgres_changes", // Listen for database changes
        {
          event: "*",                // Any event (insert, update, delete)
          schema: "public",          // In the public schema
          table: "friend_requests",  // On the friend_requests table
          filter: `sender_email=eq.${currentUserEmail}` // Where you're the sender
        },
        (payload) => {
          // When a change is detected, refresh the relevant data
          console.log("Outgoing friend request change detected:", payload);
          fetchOutgoingRequests(); // Refresh outgoing requests
          fetchFriends();          // Refresh friends list (in case a request was accepted)
        }
      )
      .subscribe();

    console.log("Supabase real-time subscriptions set up for friend requests");

    // Clean up function that runs when the component unmounts
    // or when currentUserEmail changes
    return () => {
      console.log("Cleaning up Supabase subscriptions and interval");
      clearInterval(refreshInterval); // Stop the periodic refresh
      supabase.removeChannel(incomingRequestsSub); // Remove the incoming requests subscription
      supabase.removeChannel(outgoingRequestsSub); // Remove the outgoing requests subscription
    };
  }, [currentUserEmail]); // Re-run this effect when the current user changes

  // State for outgoing friend requests (friend requests you've sent)
  const [outgoingRequests, setOutgoingRequests] = useState([]); // List of requests you've sent
  const [outgoingRequestsError, setOutgoingRequestsError] = useState(""); // Any errors with outgoing requests

  // Fetch all friend requests that the current user has sent to others
  const fetchOutgoingRequests = async () => {
    // Make sure we have a valid user email
    if (!currentUserEmail) {
      setOutgoingRequestsError("No user email available");
      return;
    }

    try {
      console.log("Fetching outgoing friend requests for:", currentUserEmail);

      // Get all pending friend requests where the current user is the sender
      const { data: requestsData, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("sender_email", currentUserEmail) // Case-insensitive match on email
        .eq("status", "pending"); // Only get pending requests (not accepted/rejected)

      // Handle any database errors
      if (error) {
        console.error("Error fetching outgoing requests:", error);
        setOutgoingRequestsError(`Error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Outgoing friend requests:", requestsData);

      // Handle case where no outgoing requests were found
      if (!requestsData || requestsData.length === 0) {
        setOutgoingRequests([]);
        setOutgoingRequestsError("");
        return;
      }

      // Get display names and avatars for all the users who received requests
      // This makes the UI more friendly by showing names instead of just emails
      const receiverEmails = requestsData.map(req => req.receiver_email);
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id")
        .in("email", receiverEmails); // Get all these users in one query

      // Handle errors getting user details
      if (usersError) {
        console.error("Error fetching user display names:", usersError);
        setOutgoingRequests(requestsData); // Fall back to using just the request data without names
        return;
      }

      // Create lookup maps for user details to make it easier to find them
      const displayNameMap = {}; // Maps email to display name
      const avatarIdMap = {};    // Maps email to avatar ID

      // Fill the lookup maps with data from the users query
      usersData.forEach(user => {
        displayNameMap[user.email] = user.displayname || user.email;
        avatarIdMap[user.email] = user.avatar_id || 1; // Default to avatar 1 if not set
      });

      // Enhance each outgoing request with the receiver's display name and avatar
      const enhancedRequests = requestsData.map(req => ({
        ...req, // Keep all the original request data
        // Add display name (fall back to email if no display name)
        receiver_display_name: displayNameMap[req.receiver_email] || req.receiver_email,
        // Add avatar ID (default to 1 if not found)
        receiver_avatar_id: avatarIdMap[req.receiver_email] || 1
      }));

      // Update state with the enhanced outgoing requests
      setOutgoingRequests(enhancedRequests);
      setOutgoingRequestsError("");
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error fetching outgoing requests:", error);
      setOutgoingRequestsError(`Unexpected error: ${error.message || "Unknown error"}`);
    }
  };



  // Render the friend system UI
  return (
    <div className="friend-system">
      {/* Header section */}
      <div className="friend-system-header">
        <h2>Friend System</h2>
      </div>

      {/* Main content container */}
      <div className="friend-system-content">
        {/* SECTION 1: Search and add friends */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Add Friend</h3>
          </div>

          {/* Search input with autocomplete */}
          <div className="search-container">
            <div className="search-input-wrapper">
              {/* Text input for searching users */}
              <input
                type="text"
                className="search-input"
                placeholder="Enter a user's display name"
                value={searchTerm}
                onChange={handleSearchInputChange} // Update as user types
                onFocus={() => searchTerm.length > 0 && setShowSuggestions(true)} // Show suggestions on focus
                onBlur={() => {
                  // Delay hiding suggestions to allow clicking on them
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />

              {/* Autocomplete dropdown */}
              {showSuggestions && userSuggestions.length > 0 && (
                <div className="email-suggestions">
                  {/* Map through all suggestions */}
                  {userSuggestions.map((user, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => selectSuggestion(user)} // Handle click on suggestion
                    >
                      <span className="suggestion-display-name">{user.displayname}</span>
                      <span className="suggestion-email">({user.email})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search button */}
            <button className="btn btn-primary" onClick={searchUser}>Search</button>
          </div>

          {/* Show any search errors */}
          {searchError && <div className="error-message">{searchError}</div>}

          {/* Show search result if a user was found */}
          {user && (
            <div className="friend-item">
              {/* User avatar */}
              <div className="friend-avatar">
                {/* Show custom avatar if available */}
                {user.avatar_id === CUSTOM_AVATAR_ID && user.custom_avatar_url ? (
                  <img
                    src={user.custom_avatar_url}
                    alt={user.displayname || user.email}
                  />
                ) : user.avatar_id ? (
                  // Show standard avatar if available
                  <img
                    src={avatars.find(a => a.id === user.avatar_id)?.url || avatars[0].url}
                    alt={user.displayname || user.email}
                  />
                ) : (
                  // Show first letter of name/email as fallback
                  user.displayname ? user.displayname.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                )}
              </div>

              {/* User info */}
              <div className="friend-info">
                <div className="friend-name">
                  {user.name || user.email} {user.displayname && `(${user.displayname})`}
                </div>
                <div className="friend-status">Found user</div>
              </div>

              {/* Action buttons or status messages */}
              <div className="friend-actions">
                {/* Different cases based on the relationship with this user */}
                {user.email === currentUserEmail ? (
                  // Case 1: This is the current user
                  <div className="friend-status-message">This is you</div>
                ) : (
                  // Case 2: Check if they're already friends
                  friends.includes(user.email) ? (
                    <div className="friend-status-message">Already friends</div>
                  ) : (
                    // Case 3: Check if there's a pending outgoing request
                    outgoingRequests.some(req => req.receiver_email === user.email) ? (
                      <div className="friend-status-message">Request pending</div>
                    ) : (
                      // Case 4: Check if there's a pending incoming request
                      requests.some(req => req.sender_email === user.email) ? (
                        <div className="friend-status-message">Request received</div>
                      ) : (
                        // Case 5: No relationship yet, show Add Friend button
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

        {/* SECTION 2: Incoming friend requests */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Incoming Friend Requests</h3>
          </div>

          {/* Show error or success messages */}
          {requestError && (
            <div className={requestError.includes("Successfully") ? "success-message" : "error-message"}>
              {requestError}
            </div>
          )}

          {/* Show message when there are no requests */}
          {requests.length === 0 && !requestError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">No incoming friend requests</div>
              </div>
            </div>
          )}

          {/* List all incoming friend requests */}
          {requests.map((req) => (
            <div key={req.id} className="friend-item">
              {/* Sender's avatar */}
              <div className="friend-avatar">
                {/* Show custom avatar if available */}
                {req.sender_avatar_id === CUSTOM_AVATAR_ID && req.sender_custom_avatar_url ? (
                  <img
                    src={req.sender_custom_avatar_url}
                    alt={req.sender_display_name || req.sender_email}
                  />
                ) : req.sender_avatar_id ? (
                  // Show standard avatar if available
                  <img
                    src={avatars.find(a => a.id === req.sender_avatar_id)?.url || avatars[0].url}
                    alt={req.sender_display_name || req.sender_email}
                  />
                ) : (
                  // Show first letter of name/email as fallback
                  (req.sender_display_name || req.sender_email).charAt(0).toUpperCase()
                )}
              </div>

              {/* Sender's info */}
              <div className="friend-info">
                <div className="friend-name">
                  {req.sender_display_name || req.sender_email}
                  {/* Show email in parentheses if display name is different */}
                  {req.sender_display_name && req.sender_display_name !== req.sender_email && (
                    <span className="friend-email">({req.sender_email})</span>
                  )}
                </div>
                <div className="friend-status">Wants to add you as a friend</div>
              </div>

              {/* Accept/Reject buttons */}
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

        {/* SECTION 3: Outgoing friend requests */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Outgoing Friend Requests</h3>
          </div>

          {/* Show any error messages */}
          {outgoingRequestsError && (
            <div className="warning-message">
              {outgoingRequestsError}
            </div>
          )}

          {/* Show message when there are no outgoing requests */}
          {outgoingRequests.length === 0 && !outgoingRequestsError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">No outgoing friend requests</div>
              </div>
            </div>
          )}

          {/* List all outgoing friend requests */}
          {outgoingRequests.map((req) => (
            <div key={req.id} className="friend-item">
              {/* Receiver's avatar */}
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

              {/* Receiver's info */}
              <div className="friend-info">
                <div className="friend-name">
                  {req.receiver_display_name || req.receiver_email}
                  {/* Show email in parentheses if display name is different */}
                  {req.receiver_display_name && req.receiver_display_name !== req.receiver_email && (
                    <span className="friend-email">({req.receiver_email})</span>
                  )}
                </div>
                <div className="friend-status">Request pending</div>
              </div>
            </div>
          ))}
        </div>

        {/* SECTION 4: Current friends list with delete option */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Delete Friends</h3>
          </div>

          {/* Show any error or success messages */}
          {friendError && (
            <div className="error-message">
              {friendError}
            </div>
          )}

          {/* Show message when there are no friends */}
          {friends.length === 0 && !friendError && (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">You have no friends yet</div>
              </div>
            </div>
          )}

          {/* List all current friends */}
          {friends.map((friend) => (
            <div key={typeof friend === 'object' ? friend.email : friend} className="friend-item">
              {/* Friend's avatar */}
              <div className="friend-avatar">
                {/* Handle different friend data formats and avatar types */}
                {typeof friend === 'object' && friend.avatarId === CUSTOM_AVATAR_ID ? (
                  // Get custom avatar URL from localStorage
                  <img
                    src={JSON.parse(localStorage.getItem('friendCustomAvatars') || '{}')[friend.email]}
                    alt={friend.displayName || friend.email}
                  />
                ) : typeof friend === 'object' && friend.avatarId ? (
                  // Show standard avatar
                  <img
                    src={avatars.find(a => a.id === friend.avatarId)?.url || avatars[0].url}
                    alt={friend.displayName || friend.email}
                  />
                ) : (
                  // Show first letter as fallback
                  typeof friend === 'object'
                    ? (friend.displayName || friend.email).charAt(0).toUpperCase()
                    : friend.charAt(0).toUpperCase()
                )}
              </div>

              {/* Friend's info */}
              <div className="friend-info">
                <div className="friend-name">
                  {/* Handle different friend data formats */}
                  {typeof friend === 'object'
                    ? friend.displayName || friend.email
                    : friend}
                  {/* Show email in parentheses if display name is different */}
                  {typeof friend === 'object' && friend.displayName && friend.displayName !== friend.email && (
                    <span className="friend-email">({friend.email})</span>
                  )}
                </div>
                <div className="friend-status">Online</div>
              </div>

              {/* Remove friend button */}
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

// Export the FriendSystem component so it can be used in other files
export default FriendSystem;

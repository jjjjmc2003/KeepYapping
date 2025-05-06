import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "../styles/FriendSystem.css";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function FriendSystem({ currentUserEmail }) {
  const [searchEmail, setSearchEmail] = useState("");
  const [user, setUser] = useState(null);
  const [searchError, setSearchError] = useState("");

  const [requests, setRequests] = useState([]);
  const [requestError, setRequestError] = useState("");

  const [friends, setFriends] = useState([]);
  const [friendError, setFriendError] = useState("");

  // --- Debug Log and Initial Connection Test ---
  useEffect(() => {
    console.log("CurrentUserEmail passed into FriendSystem:", currentUserEmail);

    // Test database connection on component mount
    testDatabaseConnection();
  }, []);

  // --- Search User ---
  const searchUser = async () => {
    setSearchError("");
    setUser(null);

    const { data, error } = await supabase
      .from("users")
      .select("email, name, displayname")
      .eq("email", searchEmail)
      .single();

    if (error) {
      console.error("Search error:", error);
      setSearchError("User not found.");
      return;
    }

    setUser(data);
  };

  // --- Send Friend Request ---
  const sendFriendRequest = async () => {
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
    setSearchEmail(""); // clear input
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

      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("receiver_email", currentUserEmail) // case-insensitive match
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching friend requests:", error);
        setRequestError(`Database error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Friend request data from Supabase:", data);

      // Check if data is null or undefined
      if (!data) {
        setRequestError("Warning: No data returned from the database.");
        setRequests([]);
        return;
      }

      // Check if data is empty
      if (data.length === 0) {
        console.log("No pending friend requests found for user:", currentUserEmail);
        setRequestError(""); // Clear any previous errors
      } else {
        console.log(`Found ${data.length} pending friend requests`);
        setRequestError(""); // Clear any previous errors
      }

      setRequests(data);
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

      const { error } = await supabase
        .from("friend_requests")
        .update({ status })
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

    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to remove ${friendEmail} from your friends list?`);
    if (!confirmed) {
      return; // User cancelled the operation
    }

    try {
      console.log(`Removing friend: ${friendEmail}`);

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

      console.log(`Successfully removed friend: ${friendEmail}`);

      // Show a temporary success message
      setFriendError(`Successfully removed ${friendEmail} from your friends list!`);
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

      const { data, error } = await supabase
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
      if (!data) {
        console.error("No data returned when fetching friends");
        setFriendError("Warning: No data returned from the database.");
        setFriends([]);
        return;
      }

      console.log("Accepted friends data from Supabase:", data);

      // Check if data is empty
      if (data.length === 0) {
        console.log("No accepted friends found for user:", currentUserEmail);
        setFriendError(""); // Clear any previous errors
        setFriends([]);
        return;
      }

      try {
        const friendList = data.map((req) =>
          req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
        );

        console.log("Processed friend list:", friendList);
        setFriends(friendList);
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

    // Set up real-time subscription for friend request changes
    const subscription = supabase
      .channel("friend-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        (payload) => {
          console.log("Friend request change detected:", payload);
          fetchFriendRequests();
          fetchFriends();
          fetchOutgoingRequests();
        }
      )
      .subscribe();

    console.log("Supabase real-time subscription set up for friend requests");

    return () => {
      console.log("Cleaning up Supabase subscription");
      supabase.removeChannel(subscription);
    };
  }, [currentUserEmail]); // Re-run when currentUserEmail changes

  // Function to manually refresh all friend data
  const refreshFriendData = () => {
    console.log("Manual refresh triggered");
    fetchFriendRequests();
    fetchFriends();
    fetchOutgoingRequests();
    testDatabaseConnection();
  };

  // States for debugging and additional functionality
  const [allRequests, setAllRequests] = useState([]);
  const [allRequestsError, setAllRequestsError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Unknown");
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [outgoingRequestsError, setOutgoingRequestsError] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  // Function to test database connection
  const testDatabaseConnection = async () => {
    try {
      setConnectionStatus("Testing...");

      // Simple query to test connection
      const { data, error } = await supabase
        .from("friend_requests")
        .select("count()", { count: "exact" })
        .limit(1);

      if (error) {
        console.error("Database connection test failed:", error);
        setConnectionStatus(`Failed: ${error.message || error.details || "Unknown error"}`);
        return false;
      }

      console.log("Database connection test successful:", data);
      setConnectionStatus("Connected");
      return true;
    } catch (error) {
      console.error("Unexpected error testing database connection:", error);
      setConnectionStatus(`Error: ${error.message || "Unknown error"}`);
      return false;
    }
  };

  // Function to fetch outgoing friend requests
  const fetchOutgoingRequests = async () => {
    if (!currentUserEmail) {
      setOutgoingRequestsError("No user email available");
      return;
    }

    try {
      console.log("Fetching outgoing friend requests for:", currentUserEmail);

      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("sender_email", currentUserEmail)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching outgoing requests:", error);
        setOutgoingRequestsError(`Error: ${error.message || error.details || "Unknown error"}`);
        return;
      }

      console.log("Outgoing friend requests:", data);
      setOutgoingRequests(data || []);
      setOutgoingRequestsError("");
    } catch (error) {
      console.error("Unexpected error fetching outgoing requests:", error);
      setOutgoingRequestsError(`Unexpected error: ${error.message || "Unknown error"}`);
    }
  };

  const fetchAllFriendRequests = async () => {
    if (!currentUserEmail) {
      setAllRequestsError("No user email available");
      return;
    }

    try {
      console.log("Fetching ALL friend requests for debugging");

      // First query: requests where user is the receiver
      const { data: receivedData, error: receivedError } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("receiver_email", currentUserEmail);

      if (receivedError) {
        console.error("Error fetching received requests:", receivedError);
        setAllRequestsError(`Error fetching received requests: ${receivedError.message}`);
        return;
      }

      // Second query: requests where user is the sender
      const { data: sentData, error: sentError } = await supabase
        .from("friend_requests")
        .select("*")
        .ilike("sender_email", currentUserEmail);

      if (sentError) {
        console.error("Error fetching sent requests:", sentError);
        setAllRequestsError(`Error fetching sent requests: ${sentError.message}`);
        return;
      }

      // Combine both sets of data
      const combined = [...(receivedData || []), ...(sentData || [])];
      console.log("All friend requests (both sent and received):", combined);

      setAllRequests(combined);
      setAllRequestsError("");

      // Also update outgoing requests while we're at it
      const pendingSent = (sentData || []).filter(req => req.status === "pending");
      setOutgoingRequests(pendingSent);
    } catch (error) {
      console.error("Unexpected error fetching all requests:", error);
      setAllRequestsError(`Unexpected error: ${error.message}`);
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
            <input
              type="email"
              className="search-input"
              placeholder="Enter a user's email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            />
            <button className="btn btn-primary" onClick={searchUser}>Search</button>
          </div>

          {searchError && <div className="error-message">{searchError}</div>}

          {user && (
            <div className="friend-item">
              <div className="friend-avatar">
                {user.displayname ? user.displayname.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {user.name || user.email} {user.displayname && `(${user.displayname})`}
                </div>
                <div className="friend-status">Found user</div>
              </div>
              <div className="friend-actions">
                <button className="btn btn-success" onClick={sendFriendRequest}>
                  Send Friend Request
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Incoming Friend Requests</h3>
            <button className="btn btn-secondary" onClick={refreshFriendData}>
              Refresh
            </button>
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
                {req.sender_email.charAt(0).toUpperCase()}
              </div>
              <div className="friend-info">
                <div className="friend-name">{req.sender_email}</div>
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
                {req.receiver_email.charAt(0).toUpperCase()}
              </div>
              <div className="friend-info">
                <div className="friend-name">{req.receiver_email}</div>
                <div className="friend-status">Request pending</div>
              </div>
            </div>
          ))}
        </div>

        {/* Friends List */}
        <div className="friend-section">
          <div className="friend-section-header">
            <h3>Friends</h3>
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
            <div key={friend} className="friend-item">
              <div className="friend-avatar">
                {friend.charAt(0).toUpperCase()}
              </div>
              <div className="friend-info">
                <div className="friend-name">{friend}</div>
                <div className="friend-status">Online</div>
              </div>
              <div className="friend-actions">
                <button
                  className="btn btn-danger btn-remove-friend"
                  onClick={() => removeFriend(friend)}
                  title="Remove friend"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Debug Toggle Button */}
        <div className="friend-section">
          <button
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? "Hide Debug Information" : "Show Debug Information"}
          </button>
        </div>

        {/* Debug Section - Toggleable */}
        {showDebug && (
          <div className="friend-section debug-section">
            <div className="friend-section-header">
              <h3>Debug Information</h3>
            </div>

            <div className="debug-info">
              <p><strong>Current User Email:</strong> {currentUserEmail || "Not set"}</p>
              <p>
                <strong>Database Connection:</strong>
                <span style={{
                  color: connectionStatus === "Connected" ? "var(--success-color)" :
                        connectionStatus === "Testing..." ? "var(--info-color)" : "var(--danger-color)",
                  fontWeight: "bold"
                }}>
                  {connectionStatus}
                </span>
              </p>
              <p><strong>Incoming Requests:</strong> {requests.length}</p>
              <p><strong>Outgoing Requests:</strong> {outgoingRequests.length}</p>
              <p><strong>Friends:</strong> {friends.length}</p>
              <p><strong>All Requests:</strong> {allRequests.length}</p>

              {outgoingRequestsError && (
                <div className="warning-message">
                  <strong>Outgoing Requests Error:</strong> {outgoingRequestsError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", marginTop: "15px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={testDatabaseConnection}
                >
                  Test Connection
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={fetchAllFriendRequests}
                >
                  Fetch All Requests
                </button>
              </div>

              {allRequestsError && (
                <div className="error-message">
                  <strong>Debug Error:</strong> {allRequestsError}
                </div>
              )}

              <details className="debug-details">
                <summary>Incoming Friend Requests (Pending)</summary>
                <pre>
                  {JSON.stringify(requests, null, 2) || "No data"}
                </pre>
              </details>

              <details className="debug-details">
                <summary>Outgoing Friend Requests (Pending)</summary>
                <pre>
                  {JSON.stringify(outgoingRequests, null, 2) || "No data"}
                </pre>
              </details>

              <details className="debug-details">
                <summary>Friends (Accepted)</summary>
                <pre>
                  {JSON.stringify(friends, null, 2) || "No data"}
                </pre>
              </details>

              <details className="debug-details">
                <summary>ALL Friend Requests</summary>
                <pre>
                  {JSON.stringify(allRequests, null, 2) || "No data"}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendSystem;

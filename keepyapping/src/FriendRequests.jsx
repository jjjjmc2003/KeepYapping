import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function FriendRequests({ userEmail }) {
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState("");

  // Fetch friend requests
  useEffect(() => {
    fetchFriendRequests();
    fetchFriends();
  }, []);

  const fetchFriendRequests = async () => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("receiver_email", userEmail)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching friend requests:", error);
      setError("Failed to fetch friend requests.");
      return;
    }

    setFriendRequests(data || []);
  };

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
      .eq("status", "accepted");

    if (error) {
      console.error("Error fetching friends:", error);
      setError("Failed to fetch friends.");
      return;
    }

    const friendList = data.map((req) =>
      req.sender_email === userEmail ? req.receiver_email : req.sender_email
    );
    setFriends(friendList);
  };

  const sendFriendRequest = async (receiverEmail) => {
    const { error } = await supabase.from("friend_requests").insert([
      {
        sender_email: userEmail,
        receiver_email: receiverEmail,
      },
    ]);

    if (error) {
      console.error("Error sending friend request:", error);
      setError("Failed to send friend request.");
      return;
    }

    alert("Friend request sent!");
  };

  const respondToRequest = async (requestId, status) => {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      console.error("Error responding to friend request:", error);
      setError("Failed to respond to friend request.");
      return;
    }

    fetchFriendRequests();
    fetchFriends();
  };

  return (
    <div>
      <h3>Friends</h3>
      <ul>
        {friends.map((friend) => (
          <li key={friend}>{friend}</li>
        ))}
      </ul>

      <h3>Friend Requests</h3>
      <ul>
        {friendRequests.map((request) => (
          <li key={request.id}>
            {request.sender_email}
            <button onClick={() => respondToRequest(request.id, "accepted")}>
              Accept
            </button>
            <button onClick={() => respondToRequest(request.id, "rejected")}>
              Reject
            </button>
          </li>
        ))}
      </ul>

      <h3>Send Friend Request</h3>
      <input
        type="email"
        placeholder="Enter email"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            sendFriendRequest(e.target.value);
            e.target.value = "";
          }
        }}
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default FriendRequests;
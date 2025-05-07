// CreateGroupChat.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function CreateGroupChat({ currentUserEmail }) {
  const [groupName, setGroupName] = useState("");
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchFriends() {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
        .eq("status", "accepted");

      if (error) {
        console.error("Failed to fetch friends:", error);
        return;
      }

      const emails = data.map(req =>
        req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
      );

      // Get display names
      const { data: users } = await supabase
        .from("users")
        .select("email, displayname")
        .in("email", emails);

      setFriends(users || []);
    }

    fetchFriends();
  }, [currentUserEmail]);

  const toggleFriend = (email) => {
    setSelectedFriends((prev) =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleCreate = async () => {
    if (!groupName || selectedFriends.length === 0) {
      alert("Please enter a group name and select at least one friend.");
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("group_chats")
      .insert([{ name: groupName, created_by: currentUserEmail }])
      .select()
      .single();

    if (groupError) {
      console.error("Error creating group:", groupError);
      return;
    }

    const members = [currentUserEmail, ...selectedFriends].map(email => ({
      group_id: group.id,
      user_email: email,
    }));

    const { error: memberError } = await supabase
      .from("group_chat_members")
      .insert(members);

    if (memberError) {
      console.error("Error adding members:", memberError);
      return;
    }

    alert("Group chat created!");
    navigate("/"); // Or redirect to the group chat
  };

  return (
    <div className="create-group-chat">
      <h2>Create a Group Chat</h2>
      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <h3>Select friends to add:</h3>
      {friends.map(friend => (
        <label key={friend.email}>
          <input
            type="checkbox"
            checked={selectedFriends.includes(friend.email)}
            onChange={() => toggleFriend(friend.email)}
          />
          {friend.displayname || friend.email}
        </label>
      ))}
      <br />
      <button onClick={handleCreate}>Create Group</button>
    </div>
  );
}

export default CreateGroupChat;

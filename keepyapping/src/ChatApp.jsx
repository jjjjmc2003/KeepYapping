// ChatApp.jsx
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ChatApp({ onLogout, userEmail: propUserEmail, selectedFriend, forceGroupChat }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [chatMode, setChatMode] = useState("group");
  const [selectedUser, setSelectedUser] = useState("");
  const [userDisplayNames, setUserDisplayNames] = useState({});
  const messageEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    (async () => {
      if (propUserEmail) {
        setUserEmail(propUserEmail);
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      }

      // Load display names from users table
      const { data: users } = await supabase.from("users").select("email, displayname");
      if (users) {
        const nameMap = {};
        users.forEach((user) => {
          nameMap[user.email] = user.displayname || user.email;
        });
        setUserDisplayNames(nameMap);
      }
    })();
  }, [propUserEmail]);

  useEffect(() => {
    if (forceGroupChat) {
      setChatMode("group");
      setSelectedUser("");
    } else if (selectedFriend) {
      setChatMode("dm");
      setSelectedUser(selectedFriend);
    }
  }, [selectedFriend, forceGroupChat]);

  useEffect(() => {
    if (userEmail) {
      fetchMessages();
      const subscription = supabase
        .channel("messages-channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          (payload) => {
            const newMsg = payload.new;
            const involved = [newMsg.sender, newMsg.recipient];
            if (
              (chatMode === "group" && newMsg.type === "group") ||
              (chatMode === "dm" &&
                involved.includes(userEmail) &&
                involved.includes(selectedUser))
            ) {
              fetchMessages();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [chatMode, selectedUser, userEmail]);

  async function fetchMessages() {
    if (!userEmail) return;

    let query = supabase.from("messages").select("*");

    if (chatMode === "group") {
      query = query.eq("type", "group").eq("recipient", "group");
    } else if (chatMode === "dm" && selectedUser) {
      query = query
        .eq("type", "dm")
        .in("sender", [userEmail, selectedUser])
        .in("recipient", [userEmail, selectedUser]);
    } else {
      setMessages([]);
      return;
    }

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      setMessages(data || []);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    const messageData = {
      text: newMessage,
      sender: userEmail,
      type: chatMode,
      recipient: chatMode === "group" ? "group" : selectedUser,
    };

    setNewMessage("");
    const { error } = await supabase.from("messages").insert([messageData]);

    if (error) {
      console.error("Error sending message:", error);
    } else {
      fetchMessages();
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
    navigate("/login");
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "20px auto",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <h3>
        {chatMode === "group"
          ? "Global Yappers Chat"
          : `Chat with ${userDisplayNames[selectedUser] || selectedUser}`}
      </h3>

      <div
        style={{
          flexGrow: 1,
          height: "380px",
          overflowY: "auto",
          padding: "15px",
          backgroundColor: "#2b2d31",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          borderRadius: "10px",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.sender === userEmail ? "flex-end" : "flex-start",
                backgroundColor: msg.sender === userEmail ? "#5865f2" : "#40444b",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: "12px",
                maxWidth: "70%",
                wordWrap: "break-word",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: "bold", opacity: 0.8 }}>
                {userDisplayNames[msg.sender] || msg.sender}
              </div>
              <div>{msg.text}</div>
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>

      <div style={{ display: "flex", paddingTop: "10px" }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          style={{
            flexGrow: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#40444b",
            color: "#fff",
            fontSize: "1rem",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            backgroundColor: "#5865f2",
            color: "white",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

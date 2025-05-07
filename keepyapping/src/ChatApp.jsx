// ChatApp.jsx
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ChatApp({ userEmail: propUserEmail, selectedFriend, selectedGroupChat, forceGroupChat, onDeleteGroupChat }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [chatMode, setChatMode] = useState("group");
  const [selectedUser, setSelectedUser] = useState("");
  const [userDisplayNames, setUserDisplayNames] = useState({});
  const messageEndRef = useRef(null);

  useEffect(() => {
    // Use a small timeout to ensure the DOM has updated
    const scrollTimeout = setTimeout(() => {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);

    return () => clearTimeout(scrollTimeout);
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
    } else if (selectedGroupChat) {
      setChatMode("groupchat");
      setSelectedUser("");
      fetchGroupChatMembers();
    }
  }, [selectedFriend, selectedGroupChat, forceGroupChat]);

  const fetchGroupChatMembers = async () => {
    if (!selectedGroupChat) return;

    try {
      // We don't need to store the members anymore, just log them
      if (selectedGroupChat.members) {
        console.log("Group chat members:", selectedGroupChat.members);
      } else {
        // If no members in the object, try to get from localStorage
        try {
          const storedGroupChats = localStorage.getItem('groupChats') || '[]';
          const parsedGroupChats = JSON.parse(storedGroupChats);

          // Find the selected group chat
          const groupChat = parsedGroupChats.find(chat => chat.id === selectedGroupChat.id);

          if (groupChat && groupChat.members) {
            console.log("Group chat members from localStorage:", groupChat.members);
          } else {
            console.log("No members found for this group chat, defaulting to current user");
          }
        } catch (storageError) {
          console.error("Error reading from localStorage:", storageError);
        }
      }
    } catch (error) {
      console.error("Unexpected error fetching group chat members:", error);
    }
  };

  useEffect(() => {
    if (!userEmail) return;

    // Initial fetch of messages
    fetchMessages();

    // Set up a timer to periodically refresh messages
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of messages");
      fetchMessages();
    }, 3000); // Refresh every 3 seconds

    // Set up real-time subscription for global chat
    const globalChatChannel = supabase
      .channel('global-chat-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'type=eq.group'
        },
        (payload) => {
          console.log("Global chat message received:", payload);
          if (chatMode === "group") {
            // Force refresh messages
            fetchMessages();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for direct messages to/from this user
    const dmChannel = supabase
      .channel(`dm-changes-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `type=eq.dm`
        },
        (payload) => {
          const newMsg = payload.new;
          console.log("DM received:", newMsg);

          // Check if this DM involves the current user
          if ((newMsg.sender === userEmail || newMsg.recipient === userEmail) &&
              chatMode === "dm" &&
              (selectedUser === newMsg.sender || selectedUser === newMsg.recipient)) {
            console.log("DM is relevant to current chat, refreshing");
            fetchMessages();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for group chat messages
    const groupChatChannel = supabase
      .channel(`group-chat-changes-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `type=eq.groupchat`
        },
        (payload) => {
          const newMsg = payload.new;
          console.log("Group chat message received:", newMsg);

          // Check if this group chat message is for the current group chat
          if (chatMode === "groupchat" &&
              selectedGroupChat &&
              newMsg.recipient === `group:${selectedGroupChat.id}`) {
            console.log("Group chat message is for current chat, refreshing");
            fetchMessages();
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up message subscriptions and interval");
      clearInterval(refreshInterval);
      supabase.removeChannel(globalChatChannel);
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(groupChatChannel);
    };
  }, [chatMode, selectedUser, selectedGroupChat, userEmail]);

  async function fetchMessages() {
    if (!userEmail) return;

    try {
      let query = supabase.from("messages").select("*");

      if (chatMode === "group") {
        // Global chat
        query = query.eq("type", "group").eq("recipient", "group");
      } else if (chatMode === "dm" && selectedUser) {
        // Direct messages
        query = query
          .eq("type", "dm")
          .in("sender", [userEmail, selectedUser])
          .in("recipient", [userEmail, selectedUser]);
      } else if (chatMode === "groupchat" && selectedGroupChat) {
        // Group chat - use a special recipient format
        query = query
          .eq("type", "groupchat")
          .eq("recipient", `group:${selectedGroupChat.id}`);
      } else {
        setMessages([]);
        return;
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) {
        console.error("Error fetching messages:", error);
        setMessages([]);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error("Unexpected error in fetchMessages:", error);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    try {
      // Create message data
      const messageData = {
        text: newMessage,
        sender: userEmail,
        type: chatMode,
        recipient: chatMode === "group" ? "group" : selectedUser,
        created_at: new Date().toISOString()
      };

      // For group chats, use a special recipient format
      if (chatMode === "groupchat" && selectedGroupChat) {
        messageData.recipient = `group:${selectedGroupChat.id}`;
      }

      // Clear the input immediately for better UX
      const messageText = newMessage;
      setNewMessage("");

      // Optimistically add the message to the UI
      const optimisticMessage = {
        ...messageData,
        id: `temp-${Date.now()}`, // Temporary ID
        text: messageText
      };

      // Add to messages state immediately
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);

      // Insert the message in the database
      const { error } = await supabase
        .from("messages")
        .insert([{...messageData, text: messageText}]);

      if (error) {
        console.error("Error sending message:", error);
        // Remove the optimistic message on error
        setMessages(prevMessages =>
          prevMessages.filter(msg => msg.id !== optimisticMessage.id)
        );
        return;
      }

      // The real-time subscription will handle updating the message list
      // No need to call fetchMessages() here
    } catch (error) {
      console.error("Unexpected error in sendMessage:", error);
    }
  }



  // Get chat title based on chat mode
  const getChatTitle = () => {
    if (chatMode === "group") {
      return "Global Yappers Chat";
    } else if (chatMode === "dm") {
      return `Chat with ${userDisplayNames[selectedUser] || selectedUser}`;
    } else if (chatMode === "groupchat" && selectedGroupChat) {
      return selectedGroupChat.name;
    }
    return "Chat";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>{getChatTitle()}</h3>
        {chatMode === "groupchat" && selectedGroupChat && onDeleteGroupChat && (
          <button
            onClick={() => onDeleteGroupChat(selectedGroupChat.id)}
            style={{
              backgroundColor: "#f04747",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Delete Group Chat
          </button>
        )}
      </div>

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

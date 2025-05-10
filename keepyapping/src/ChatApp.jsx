// ChatApp.jsx
import React, { useState, useEffect, useRef, use } from "react";
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
  const [isUploading, setIsUploading] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  // Track if user has manually scrolled
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollTop = messageEndRef.current.scrollHeight;
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    if (messageEndRef.current) {
      // If user scrolls up, mark that they've manually scrolled
      if (messageEndRef.current.scrollHeight - messageEndRef.current.scrollTop > messageEndRef.current.clientHeight + 100) {
        setUserHasScrolled(true);
      } else {
        // If they scroll near the bottom, reset the flag
        setUserHasScrolled(false);
      }
    }
  };

  // Add and remove scroll event listener
  useEffect(() => {
    const messageContainer = messageEndRef.current;
    if (messageContainer) {
      messageContainer.addEventListener('scroll', handleScroll);
      return () => {
        messageContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Scroll to bottom when changing chats
  useEffect(() => {
    scrollToBottom();
    setUserHasScrolled(false); // Reset scroll flag when changing chats
  }, [chatMode, selectedUser, selectedGroupChat]);

  // Auto-scroll for new messages only if user hasn't manually scrolled
  useEffect(() => {
    if (!userHasScrolled) {
      scrollToBottom();
    }
  }, [messages, userHasScrolled]);

  // Set up storage bucket for images
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const isReady = await setUpStorage(); // Get the return value
        setStorageReady(isReady); // Only set ready if true
        console.log("Storage setup complete, ready:", isReady);
      } catch (error) {
        console.error("Error setting up storage:", error);
        setStorageReady(false); // Make sure it's false on error
      }
    };
    initializeChat();
  }, []);

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
      // Reset the scroll flag when user sends a message
      setUserHasScrolled(false);

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

  // Handles image selection and upload
  const hangleImageSelected = async (event) => {
    const file = event.target.files[0];
    if(!file) return;
    if(!storageReady) {
      alert("Storage is not ready. Please try again later.");
      return;
    }

    if(!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size> 5 * 1024 * 1024) { // 5MB limit
      alert("File size exceeds 5MB limit.");
      return;
    }
    setIsUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      const messageData = {
        text: file.name,
        sender: userEmail,
        type: chatMode,
        recipient: chatMode === "group" ? "group" : selectedUser,
        created_at: new Date().toISOString(),
        media_url: imageUrl,
        message_type: "image"
      };

      if (chatMode === "groupchat" && selectedGroupChat) {
        messageData.recipient = `group:${selectedGroupChat.id}`;
      }

      const optimisticMessage = {
        ...messageData,
        id: `temp-${Date.now()}`, // Temporary ID
      };

      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      // Reset the scroll flag when user sends an image
      setUserHasScrolled(false);

      const { error } = await supabase
      .from("messages")
      .insert([messageData]);

        if (error) {
          console.error("Error sending image message:", error);
          setMessages(prevMessages =>
            prevMessages.filter(msg => msg.id !== optimisticMessage.id)
          );
        }
        event.target.value = null; // Reset the file input
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error uploading image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };


//handles paste event for images
  const handlePaste = async (event) => {
  const clipboardData = event.clipboardData;
  if (!clipboardData || !clipboardData.items) return;

  // Check if the clipboard contains image data
  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) { // Fix: indexOf instead of indextOf
      console.log("Image found in clipboard, uploading...");
      event.preventDefault();

      if (!storageReady) {
        alert("Storage is not ready. Please try again later.");
        return;
      }
      //makes sure the file is an image and doesnt go over the size limit
      const file = items[i].getAsFile();
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("File size exceeds 5MB limit.");
        return;
      }

      const timestamp = Date.now();
      const filename = `clipboard-image-${timestamp}.png`;

      // Create a named file from the clipboard file
      const namedFile = new File([file], filename, { type: file.type });

      setIsUploading(true);

      try {
        const imageUrl = await uploadImage(namedFile);
        const messageData = {
          text: "Pasted image",
          sender: userEmail,
          type: chatMode,
          recipient: chatMode === "group" ? "group" : selectedUser,
          created_at: new Date().toISOString(),
          media_url: imageUrl,
          message_type: "image"
        };

        if (chatMode === "groupchat" && selectedGroupChat) {
          messageData.recipient = `group:${selectedGroupChat.id}`;
        }

        const optimisticMessage = {
          ...messageData,
          id: `temp-${timestamp}`,
        };

        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        // Reset the scroll flag when user sends a pasted image
        setUserHasScrolled(false);

        const { error } = await supabase.from("messages").insert([messageData]);

        if (error) {
          console.error("Error sending pasted image message:", error);
          setMessages(prevMessages =>
            prevMessages.filter(msg => msg.id !== `temp-${timestamp}`)
          );
        }
      } catch (error) {
        console.error("Error uploading pasted image:", error);
        alert("Error uploading pasted image. Please try again.");
      } finally {
        setIsUploading(false);
      }
      break;
    }
  }

};



  //sets up the storage bucket for images
  const setUpStorage = async () => {
    try {
      console.log("Setting up storage bucket");
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      console.log("Buckets:", buckets);

      if (listError) {
        console.error("Error listing buckets:", listError);
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      if (!buckets.find(bucket => bucket.name === "chat-images")) {
        console.error("Chat images bucket not found. Please create it in the Supabase dashboard.");
        alert("Image storage is not properly configured. Please contact an administrator.");
        return false;
      } else {
        console.log("Chat images bucket exists and is ready to use");
        return true;
      }
    } catch (error) {
      console.error("Storage setup check failed:", error);
      return false;
    }
  };

  // Uploads the image to Supabase storage and returns the public URL
  const uploadImage = async (file) => {
    try {
      const fileExtension = file.name.split(".").pop();
      const fileName = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      const filePath = `${userEmail}/${fileName}`;

      console.log("Attempting to upload file to path:", filePath);

      // Upload the image to Supabase storage
      const { error } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Upload error details:", error);
        throw new Error("Error uploading image: " + error.message);
      }

      console.log("File uploaded successfully, getting public URL");

      // Get the public URL of the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Full upload error:", error);
      throw error;
    }
  };

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
        maxWidth: "90%",
        margin: "10px auto",
        height: "85vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
      }}
    >
      {/* Header with title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>{getChatTitle()}</h3>
        {chatMode === "groupchat" && selectedGroupChat && onDeleteGroupChat && selectedGroupChat.creator === userEmail && (
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

      {/* Chat messages container  */}
      <div
        ref={messageEndRef}
        style={{
          flexGrow: 1,
          height: "calc(85vh - 130px)",
          overflowY: "auto",
          padding: "15px",
          backgroundColor: "#2b2d31",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          borderRadius: "10px 10px 0 0",
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

              {msg.message_type === "image" ? (
                <div>
                  <img
                    src={msg.media_url}
                    alt={msg.text || "Shared image"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                    onClick={() => window.open(msg.media_url, '_blank')}
                  />
                  {msg.text && <div style={{ marginTop: "5px", fontSize: "0.9rem" }}>{msg.text}</div>}
                </div>
              ) : (
                <div>{msg.text}</div>
              )}
            </div>
          ))
        )}
        {/* We don't need this anymore since we're using the container ref */}
      </div>

      {/* Separate input area */}
      <div
        style={{
          backgroundColor: "#2b2d31",
          padding: "12px 15px",
          borderRadius: "0 0 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Message input and buttons */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            onPaste={handlePaste}
            style={{
              flexGrow: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#40444b",
              color: "#fff",
              fontSize: "1rem",
            }}
          />

          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={hangleImageSelected}
            style={{display: "none"}}
          />

          <label htmlFor="image-upload" style={{
            marginLeft: "8px",
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "#40444b",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            📷
          </label>

          <button
            onClick={sendMessage}
            style={{
              marginLeft: "8px",
              padding: "12px 16px",
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

        {/* Upload status indicator */}
        {isUploading && (
          <div style={{ color: "#999", textAlign: "left" }}>
            Uploading image...
          </div>
        )}
      </div>
    </div>
  );

}

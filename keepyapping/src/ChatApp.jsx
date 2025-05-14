import React, { useState, useEffect, useRef, use } from "react";
import { createClient } from "@supabase/supabase-js"; 

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Main ChatApp component that handles all chat functionality
// Props:
// - userEmail: The current user's email (passed as propUserEmail)
// - selectedFriend: Email of the friend the user is chatting with (for DMs)
// - selectedGroupChat: Group chat object containing id, name, etc.
// - forceGroupChat: Boolean to force showing the global chat
// - onDeleteGroupChat: Function to call when deleting a group chat
// - onLeaveGroupChat: Function to call when leaving a group chat
export default function ChatApp({ userEmail: propUserEmail, selectedFriend, selectedGroupChat, forceGroupChat, onDeleteGroupChat, onLeaveGroupChat }) {
  // State for storing all chat messages
  const [messages, setMessages] = useState([]);
  // State for the message being typed
  const [newMessage, setNewMessage] = useState("");
  // Current user's email (either from props or from auth)
  const [userEmail, setUserEmail] = useState("");
  // Current chat mode: "group" (global), "dm" (direct message), or "groupchat"
  const [chatMode, setChatMode] = useState("group");
  // Email of the selected user for direct messages
  const [selectedUser, setSelectedUser] = useState("");
  // Map of user emails to display names for showing friendly names
  const [userDisplayNames, setUserDisplayNames] = useState({});
  // Reference to the message container for scrolling
  const messageEndRef = useRef(null);
  // Whether an image is currently being uploaded
  const [isUploading, setIsUploading] = useState(false);
  // Whether the storage bucket is ready for image uploads
  const [storageReady, setStorageReady] = useState(true);
  // Track if user has manually scrolled up (to prevent auto-scrolling)
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Function to automatically scroll the chat to the bottom (newest messages)
  const scrollToBottom = () => {
    if (messageEndRef.current) {
      // Set the scroll position to the maximum height (bottom of container)
      messageEndRef.current.scrollTop = messageEndRef.current.scrollHeight;
    }
  };

  // Detect when the user manually scrolls in the chat
  const handleScroll = () => {
    if (messageEndRef.current) {
      // Calculate how far from the bottom the user has scrolled
      // If they're more than 100px from the bottom, consider it a manual scroll up
      if (messageEndRef.current.scrollHeight - messageEndRef.current.scrollTop > messageEndRef.current.clientHeight + 100) {
        setUserHasScrolled(true); // User has scrolled up to read older messages
      } else {
        // User has scrolled back to the bottom area
        setUserHasScrolled(false); // Reset the flag so auto-scrolling resumes
      }
    }
  };

  // Set up the scroll event listener when the component mounts
  useEffect(() => {
    const messageContainer = messageEndRef.current;
    if (messageContainer) {
      // Add scroll event listener to detect manual scrolling
      messageContainer.addEventListener('scroll', handleScroll);

      // Clean up the event listener when component unmounts
      return () => {
        messageContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []); // Empty dependency array means this runs once on mount

  // Automatically scroll to bottom whenever the user changes chats
  useEffect(() => {
    scrollToBottom(); // Scroll to the newest messages
    setUserHasScrolled(false); // Reset the scroll flag when changing chats
  }, [chatMode, selectedUser, selectedGroupChat]); // Run when any chat selection changes

  // Auto-scroll for new messages, but only if the user isn't reading older messages
  useEffect(() => {
    if (!userHasScrolled) {
      // Only auto-scroll if the user hasn't manually scrolled up
      scrollToBottom();
    }
  }, [messages, userHasScrolled]); // Run when messages change or scroll state changes

  // Initialize the storage system for image uploads when the component mounts
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Check if the storage bucket exists and is accessible
        const isReady = await setUpStorage();
        setStorageReady(isReady); // Update state based on storage availability
        console.log("Storage setup complete, ready:", isReady);
      } catch (error) {
        // Handle any errors during storage setup
        console.error("Error setting up storage:", error);
        setStorageReady(false); // Mark storage as not ready if there's an error
      }
    };
    // Run the initialization
    initializeChat();
  }, []); // Empty dependency array means this runs once on component mount

  // Set up the user's email and load display names for all users
  useEffect(() => {
    (async () => {
      // Set the user's email - either from props or from the auth session
      if (propUserEmail) {
        // Use the email passed as a prop if available
        setUserEmail(propUserEmail);
      } else {
        // Otherwise, get the email from the current auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      }

      // Load all users' display names from the database for showing friendly names
      const { data: users } = await supabase.from("users").select("email, displayname");
      if (users) {
        // Create a mapping of email addresses to display names
        const nameMap = {};
        users.forEach((user) => {
          // Use the display name if available, otherwise use the email
          nameMap[user.email] = user.displayname || user.email;
        });
        // Update state with the display names
        setUserDisplayNames(nameMap);
      }
    })();
  }, [propUserEmail]); // Re-run if the propUserEmail changes

  // Set the chat mode based on what's selected (global chat, DM, or group chat)
  useEffect(() => {
    if (forceGroupChat) {
      // If global chat is forced, show the global chat
      setChatMode("group");
      setSelectedUser("");
    } else if (selectedFriend) {
      // If a friend is selected, show the direct message chat with that friend
      setChatMode("dm");
      setSelectedUser(selectedFriend);
    } else if (selectedGroupChat) {
      // If a group chat is selected, show that group chat
      setChatMode("groupchat");
      setSelectedUser("");
      // Get the members of the selected group chat
      fetchGroupChatMembers();
    }
  }, [selectedFriend, selectedGroupChat, forceGroupChat]); // Re-run when any of these change

  // Get the members of the selected group chat
  const fetchGroupChatMembers = async () => {
    // Don't do anything if no group chat is selected
    if (!selectedGroupChat) return;

    try {
      // First try to get members from the selectedGroupChat object
      if (selectedGroupChat.members) {
        // If members are already in the object, just log them
        console.log("Group chat members:", selectedGroupChat.members);
      } else {
        // If no members in the object, try to get them from localStorage
        try {
          // Get all group chats from localStorage
          const storedGroupChats = localStorage.getItem('groupChats') || '[]';
          const parsedGroupChats = JSON.parse(storedGroupChats);

          // Find the specific group chat we're looking for
          const groupChat = parsedGroupChats.find(chat => chat.id === selectedGroupChat.id);

          // Check if we found the group chat and it has members
          if (groupChat && groupChat.members) {
            console.log("Group chat members from localStorage:", groupChat.members);
          } else {
            // If we can't find members, log a fallback message
            console.log("No members found for this group chat, defaulting to current user");
          }
        } catch (storageError) {
          // Handle any errors reading from localStorage
          console.error("Error reading from localStorage:", storageError);
        }
      }
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error fetching group chat members:", error);
    }
  };

  // Set up message fetching and real-time subscriptions
  useEffect(() => {
    // Don't do anything if we don't have the user's email yet
    if (!userEmail) return;

    // Get the initial messages for the current chat
    fetchMessages();

    // Set up a timer to periodically refresh messages as a backup
    // (in case real-time updates miss something)
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of messages");
      fetchMessages();
    }, 3000); // Refresh every 3 seconds

    //  REAL-TIME SUBSCRIPTIONS

    // Set up real-time subscription for global chat messages
    const globalChatChannel = supabase
      .channel('global-chat-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Listen for new messages
          schema: 'public',
          table: 'messages',
          filter: 'type=eq.group' // Only for global chat messages
        },
        (payload) => {
          // When a new global chat message is received
          console.log("Global chat message received:", payload);
          // Only refresh if we're currently viewing the global chat
          if (chatMode === "group") {
            // Update the messages list
            fetchMessages();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for direct messages (DMs)
    // Create a unique channel name using the user's email
    const dmChannel = supabase
      .channel(`dm-changes-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `type=eq.dm` // Only for direct messages
        },
        (payload) => {
          // When a new DM is received
          const newMsg = payload.new;
          console.log("DM received:", newMsg);

          // Check if this DM is relevant to the current chat:
          //  It involves the current user sender or recipient
          //  We're in DM mode
          //  The selected user is the other person in the conversation
          if ((newMsg.sender === userEmail || newMsg.recipient === userEmail) &&
              chatMode === "dm" &&
              (selectedUser === newMsg.sender || selectedUser === newMsg.recipient)) {
            console.log("DM is relevant to current chat, refreshing");
            fetchMessages(); // Update the messages list
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
          filter: `type=eq.groupchat` // Only for group chat messages
        },
        (payload) => {
          // When a new group chat message is received
          const newMsg = payload.new;
          console.log("Group chat message received:", newMsg);

          // Check if this message is for the group chat we're currently viewing
          if (chatMode === "groupchat" &&
              selectedGroupChat &&
              newMsg.recipient === `group:${selectedGroupChat.id}`) {
            console.log("Group chat message is for current chat, refreshing");
            fetchMessages(); // Update the messages list
          }
        }
      )
      .subscribe();

    // Clean up function that runs when component unmounts or dependencies change
    return () => {
      console.log("Cleaning up message subscriptions and interval");
      clearInterval(refreshInterval); // Stop the periodic refresh
      // Remove all the real-time subscriptions
      supabase.removeChannel(globalChatChannel);
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(groupChatChannel);
    };
  }, [chatMode, selectedUser, selectedGroupChat, userEmail]); // Re-run when any of these change

  // Fetch messages for the current chat from the database
  async function fetchMessages() {
    // Don't do anything if we don't have the user's email
    if (!userEmail) return;

    try {
      // Start with a basic query to the messages table
      let query = supabase.from("messages").select("*");

      // Modify the query based on the current chat mode
      if (chatMode === "group") {
        // For global chat: get messages with type "group" sent to "group"
        query = query.eq("type", "group").eq("recipient", "group");
      } else if (chatMode === "dm" && selectedUser) {
        // For direct messages: get messages between the current user and selected friend
        // This requires checking both directions (messages sent and received)
        query = query
          .eq("type", "dm")
          .in("sender", [userEmail, selectedUser]) // Either user could be the sender
          .in("recipient", [userEmail, selectedUser]); // Either user could be the recipient
      } else if (chatMode === "groupchat" && selectedGroupChat) {
        // For group chats: get messages sent to this specific group
        // Group chat recipients have format "group:[groupId]"
        query = query
          .eq("type", "groupchat")
          .eq("recipient", `group:${selectedGroupChat.id}`);
      } else {
        // If none of the above conditions are met, clear messages and exit
        setMessages([]);
        return;
      }

      // Execute the query, sorting messages by creation time (oldest first)
      const { data, error } = await query.order("created_at", { ascending: true });

      if (error) {
        // Handle any database errors
        console.error("Error fetching messages:", error);
        setMessages([]);
      } else {
        // Update the messages state with the fetched data
        setMessages(data || []);
      }
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error in fetchMessages:", error);
      setMessages([]);
    }
  }

  // Send a new text message
  async function sendMessage() {
    // Don't send empty messages
    if (!newMessage.trim()) return;

    try {
      // Create the message data object
      const messageData = {
        text: newMessage, // Message content
        sender: userEmail, // Current user is the sender
        type: chatMode, // Type depends on current chat mode
        recipient: chatMode === "group" ? "group" : selectedUser, // Who receives the message
        created_at: new Date().toISOString() // Current timestamp
      };

      // For group chats, use special recipient format "group:[groupId]"
      if (chatMode === "groupchat" && selectedGroupChat) {
        messageData.recipient = `group:${selectedGroupChat.id}`;
      }

      // Save the message text and clear the input field immediately for better UX
      const messageText = newMessage;
      setNewMessage("");

      // Create an optimistic message to show immediately in the UI
      // This makes the app feel faster while the database operation completes
      const optimisticMessage = {
        ...messageData,
        id: `temp-${Date.now()}`, // Temporary ID until we get the real one
        text: messageText
      };

      // Add the optimistic message to the UI immediately
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);

      // Reset the scroll flag so we auto-scroll to the new message
      setUserHasScrolled(false);

      // Actually insert the message in the database
      const { error } = await supabase
        .from("messages")
        .insert([{...messageData, text: messageText}]);

      if (error) {
        // If there's an error saving to the database
        console.error("Error sending message:", error);
        // Remove the optimistic message from the UI
        setMessages(prevMessages =>
          prevMessages.filter(msg => msg.id !== optimisticMessage.id)
        );
        return;
      }

      // The real-time subscription will handle updating the message list
      // with the actual message from the database (including the real ID)
    } catch (error) {
      // Handle any unexpected errors
      console.error("Unexpected error in sendMessage:", error);
    }
  }

  // Handle when a user selects an image file to upload
  const hangleImageSelected = async (event) => {
    // Get the selected file from the input element
    const file = event.target.files[0];

    // If no file was selected, do nothing
    if(!file) return;

    // Check if the storage system is ready
    if(!storageReady) {
      alert("Storage is not ready. Please try again later.");
      return;
    }

    // Validate that the file is actually an image
    if(!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    // Check file size - limit to 5MB to prevent large uploads
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert("File size exceeds 5MB limit.");
      return;
    }

    // Show uploading indicator
    setIsUploading(true);

    try {
      // Upload the image to storage and get its URL
      const imageUrl = await uploadImage(file);

      // Create message data for the image message
      const messageData = {
        text: file.name, // Use the filename as the message text
        sender: userEmail,
        type: chatMode,
        recipient: chatMode === "group" ? "group" : selectedUser,
        created_at: new Date().toISOString(),
        media_url: imageUrl, // URL to the uploaded image
        message_type: "image" // Mark this as an image message
      };

      // For group chats, use the special recipient format
      if (chatMode === "groupchat" && selectedGroupChat) {
        messageData.recipient = `group:${selectedGroupChat.id}`;
      }

      // Create an optimistic message to show immediately
      const optimisticMessage = {
        ...messageData,
        id: `temp-${Date.now()}`, // Temporary ID until we get the real one
      };

      // Add the optimistic message to the UI
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);

      // Reset the scroll flag so we auto-scroll to the new image
      setUserHasScrolled(false);

      // Save the message to the database
      const { error } = await supabase
        .from("messages")
        .insert([messageData]);

      // Handle any errors saving to the database
      if (error) {
        console.error("Error sending image message:", error);
        // Remove the optimistic message if there was an error
        setMessages(prevMessages =>
          prevMessages.filter(msg => msg.id !== optimisticMessage.id)
        );
      }

      // Reset the file input so the same file can be selected again if needed
      event.target.value = null;
    } catch (error) {
      // Handle any errors during upload
      console.error("Error uploading image:", error);
      alert("Error uploading image. Please try again.");
    } finally {
      // Hide the uploading indicator when done (whether successful or not)
      setIsUploading(false);
    }
  };


  // Handle when a user pastes an image from clipboard
  const handlePaste = async (event) => {
    // Get the clipboard data from the paste event
    const clipboardData = event.clipboardData;
    // If there's no clipboard data, do nothing
    if (!clipboardData || !clipboardData.items) return;

    // Check all items in the clipboard to see if any are images
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      // If we find an image in the clipboard
      if (items[i].type.indexOf("image") !== -1) {
        console.log("Image found in clipboard, uploading...");
        // Prevent the default paste behavior (which would paste text)
        event.preventDefault();

        // Check if storage is ready for uploads
        if (!storageReady) {
          alert("Storage is not ready. Please try again later.");
          return;
        }

        // Get the file from the clipboard item
        const file = items[i].getAsFile();

        // Check file size - limit to 5MB
        if (file.size > 5 * 1024 * 1024) {
          alert("File size exceeds 5MB limit.");
          return;
        }

        // Create a unique filename for the pasted image
        const timestamp = Date.now();
        const filename = `clipboard-image-${timestamp}.png`;

        // Create a proper File object with a name (clipboard files don't have names)
        const namedFile = new File([file], filename, { type: file.type });

        // Show uploading indicator
        setIsUploading(true);

        try {
          // Upload the image and get its URL
          const imageUrl = await uploadImage(namedFile);

          // Create message data for the pasted image
          const messageData = {
            text: "Pasted image", // Generic text for pasted images
            sender: userEmail,
            type: chatMode,
            recipient: chatMode === "group" ? "group" : selectedUser,
            created_at: new Date().toISOString(),
            media_url: imageUrl, // URL to the uploaded image
            message_type: "image" // Mark this as an image message
          };

          // For group chats, use the special recipient format
          if (chatMode === "groupchat" && selectedGroupChat) {
            messageData.recipient = `group:${selectedGroupChat.id}`;
          }

          // Create an optimistic message to show immediately
          const optimisticMessage = {
            ...messageData,
            id: `temp-${timestamp}`, // Temporary ID using the timestamp
          };

          // Add the optimistic message to the UI
          setMessages(prevMessages => [...prevMessages, optimisticMessage]);

          // Reset the scroll flag so we auto-scroll to the new image
          setUserHasScrolled(false);

          // Save the message to the database
          const { error } = await supabase.from("messages").insert([messageData]);

          // Handle any errors saving to the database
          if (error) {
            console.error("Error sending pasted image message:", error);
            // Remove the optimistic message if there was an error
            setMessages(prevMessages =>
              prevMessages.filter(msg => msg.id !== `temp-${timestamp}`)
            );
          }
        } catch (error) {
          // Handle any errors during upload
          console.error("Error uploading pasted image:", error);
          alert("Error uploading pasted image. Please try again.");
        } finally {
          // Hide the uploading indicator when done
          setIsUploading(false);
        }
        // We only handle the first image found, so break the loop
        break;
      }
    }
  };



  // Check if the storage bucket for images exists and is accessible
  const setUpStorage = async () => {
    try {
      console.log("Setting up storage bucket");
      // Get a list of all storage buckets in the Supabase project
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      console.log("Buckets:", buckets);

      // Handle any errors getting the bucket list
      if (listError) {
        console.error("Error listing buckets:", listError);
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      // Check if our "chat-images" bucket exists
      if (!buckets.find(bucket => bucket.name === "chat-images")) {
        // If the bucket doesn't exist, show an error
        console.error("Chat images bucket not found. Please create it in the Supabase dashboard.");
        alert("Image storage is not properly configured. Please contact an administrator.");
        return false; // Storage is not ready
      } else {
        // Bucket exists and is ready to use
        console.log("Chat images bucket exists and is ready to use");
        return true; // Storage is ready
      }
    } catch (error) {
      // Handle any unexpected errors
      console.error("Storage setup check failed:", error);
      return false; // Storage is not ready
    }
  };

  // Upload an image file to Supabase storage and return its public URL
  const uploadImage = async (file) => {
    try {
      // Extract the file extension from the filename
      const fileExtension = file.name.split(".").pop();

      // Create a unique filename using timestamp and random string
      // This prevents filename collisions in storage
      const fileName = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

      // Create a path that includes the user's email to organize files by user
      const filePath = `${userEmail}/${fileName}`;

      console.log("Attempting to upload file to path:", filePath);

      // Upload the image to the "chat-images" bucket in Supabase storage
      const { error } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file, {
          cacheControl: '3600', // Cache control for 1 hour
          upsert: false // Don't overwrite existing files with the same name
        });

      // Handle any upload errors
      if (error) {
        console.error("Upload error details:", error);
        throw new Error("Error uploading image: " + error.message);
      }

      console.log("File uploaded successfully, getting public URL");

      // Get the public URL of the uploaded image so we can display it
      const { data: { publicUrl } } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      // Return the public URL to use in the message
      return publicUrl;
    } catch (error) {
      // Handle and re-throw any errors
      console.error("Full upload error:", error);
      throw error;
    }
  };

  // Get the appropriate title for the current chat
  const getChatTitle = () => {
    if (chatMode === "group") {
      // For global chat, show a standard title
      return "Global Yappers Chat";
    } else if (chatMode === "dm") {
      // For direct messages, show "Chat with [friend's name]"
      // Use the display name if available, otherwise use their email
      return `Chat with ${userDisplayNames[selectedUser] || selectedUser}`;
    } else if (chatMode === "groupchat" && selectedGroupChat) {
      // For group chats, show the group chat name
      return selectedGroupChat.name;
    }
    // Fallback title if none of the above apply
    return "Chat";
  };

  // Render the chat interface
  return (
    <div
      style={{
        maxWidth: "90%",
        margin: "10px auto",
        height: "85vh", // Take up most of the viewport height
        textAlign: "center",
        display: "flex",
        flexDirection: "column", // Stack elements vertically
        gap: "15px", // Space between elements
      }}
    >
      {/* Header section with chat title and action buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Chat title - changes based on the current chat mode */}
        <h3>{getChatTitle()}</h3>

        {/* Action buttons for group chats */}
        <div>
          {/* "Leave Group Chat" button - only shown for group members who aren't the creator */}
          {chatMode === "groupchat" && selectedGroupChat && onLeaveGroupChat && selectedGroupChat.creator !== userEmail && (
            <button
              onClick={() => onLeaveGroupChat(selectedGroupChat.id)}
              style={{
                backgroundColor: "#4f545c", // Gray button
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: "0.9rem",
                marginRight: "8px"
              }}
            >
              Leave Group Chat
            </button>
          )}

          {/* "Delete Group Chat" button - only shown for the group creator */}
          {chatMode === "groupchat" && selectedGroupChat && onDeleteGroupChat && selectedGroupChat.creator === userEmail && (
            <button
              onClick={() => onDeleteGroupChat(selectedGroupChat.id)}
              style={{
                backgroundColor: "#f04747", // Red button for destructive action
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
      </div>

      {/* Messages container - this is where all the chat messages appear */}
      <div
        ref={messageEndRef} // Reference used for scrolling
        style={{
          flexGrow: 1, // Take up available space
          height: "calc(85vh - 130px)", // Calculate height based on viewport
          overflowY: "auto", // Enable scrolling for overflow
          padding: "15px",
          backgroundColor: "#2b2d31", // Dark background
          display: "flex",
          flexDirection: "column", // Stack messages vertically
          gap: "10px", // Space between messages
          borderRadius: "10px 10px 0 0", // Rounded top corners
        }}
      >
        {/* Show a placeholder message if there are no messages */}
        {messages.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>No messages yet.</p>
        ) : (
          // Map through all messages and render each one
          messages.map((msg) => (
            <div
              key={msg.id} // Unique key for each message
              style={{
                // Align messages to right (sent) or left (received)
                alignSelf: msg.sender === userEmail ? "flex-end" : "flex-start",
                // Different colors for sent vs received messages
                backgroundColor: msg.sender === userEmail ? "#5865f2" : "#40444b",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: "12px",
                maxWidth: "70%", // Limit width for better readability
                wordWrap: "break-word", // Wrap long text
              }}
            >
              {/* Sender's name/email */}
              <div style={{ fontSize: "0.75rem", fontWeight: "bold", opacity: 0.8 }}>
                {userDisplayNames[msg.sender] || msg.sender}
              </div>

              {/* Render different content based on message type */}
              {msg.message_type === "image" ? (
                // For image messages
                <div>
                  {/* The image itself */}
                  <img
                    src={msg.media_url}
                    alt={msg.text || "Shared image"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px", // Limit height
                      borderRadius: "8px",
                      cursor: "pointer" // Show pointer on hover
                    }}
                    onClick={() => window.open(msg.media_url, '_blank')} // Open full image in new tab when clicked
                  />
                  {/* Optional caption text */}
                  {msg.text && <div style={{ marginTop: "5px", fontSize: "0.9rem" }}>{msg.text}</div>}
                </div>
              ) : (
                // For regular text messages
                <div>{msg.text}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Message input area at the bottom */}
      <div
        style={{
          backgroundColor: "#2b2d31", // Match the messages container
          padding: "12px 15px",
          borderRadius: "0 0 10px 10px", // Rounded bottom corners
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Row with text input, image upload, and send button */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Text input field */}
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)} // Update state as user types
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage(); // Send on Enter key
            }}
            onPaste={handlePaste} // Handle pasted images
            style={{
              flexGrow: 1, // Take up available space
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#40444b",
              color: "#fff",
              fontSize: "1rem",
            }}
          />

          {/* Hidden file input for image uploads */}
          <input
            type="file"
            id="image-upload"
            accept="image/*" // Only accept image files
            onChange={hangleImageSelected}
            style={{display: "none"}} // Hidden, triggered by the label
          />

          {/* Camera icon button (label for the hidden file input) */}
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

          {/* Send button */}
          <button
            onClick={sendMessage}
            style={{
              marginLeft: "8px",
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#5865f2", // Discord-like blue
              color: "white",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>

        {/* Show uploading indicator when an image is being uploaded */}
        {isUploading && (
          <div style={{ color: "#999", textAlign: "left" }}>
            Uploading image...
          </div>
        )}
      </div>
    </div>
  );

}

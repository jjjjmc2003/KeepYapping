import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/HomePage.css";
import ChatApp from "./ChatApp";
import FriendSystem from "./FriendSystem";
import ProfileEditor from "./ProfileEditor";
import GroupChatCreator from "./GroupChatCreator";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function HomePage({ onLogout }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [friends, setFriends] = useState([]);
  const [friendDisplayNames, setFriendDisplayNames] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [selectedFriend, setSelectedFriend] = useState("");
  const [selectedGroupChat, setSelectedGroupChat] = useState(null);
  const [showGroupChatCreator, setShowGroupChatCreator] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [filteredGroupChats, setFilteredGroupChats] = useState([]);

  useEffect(() => {
    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return navigate("/login");

      const email = session.user.email;
      setUserEmail(email);

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (userData) {
        setUserName(userData.displayname || userData.name || userData.email);
      }
    }

    fetchUserData();
  }, [navigate]);

  useEffect(() => {
    if (!userEmail) return;

    // Initialize app
    refreshFriendsList();
    initializeGroupChats();

    // Set up periodic refresh for both friends and group chats
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh of friends and group chats");
      refreshFriendsList();
      initializeGroupChats();
    }, 5000); // Refresh every 5 seconds

    // Create unique channel names for this user
    const userPrefix = userEmail.replace(/[^a-zA-Z0-9]/g, '');

    // Set up real-time subscription for friend requests involving this user
    console.log("Setting up real-time subscription for friend requests");
    const friendRequestsSub = supabase
      .channel(`friend-requests-${userPrefix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `sender_email=eq.${userEmail}`
        },
        (payload) => {
          console.log("Friend request from current user updated:", payload);
          refreshFriendsList();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_email=eq.${userEmail}`
        },
        (payload) => {
          console.log("Friend request to current user updated:", payload);
          refreshFriendsList();
        }
      )
      .subscribe();

    // Set up real-time subscription for group chat messages involving this user
    const groupChatMessagesSub = supabase
      .channel(`group-chat-messages-${userPrefix}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `type=eq.groupchat`
        },
        (payload) => {
          const newMsg = payload.new;

          // Check if this is a group chat message
          if (newMsg.recipient.startsWith("group:")) {
            console.log("Group chat message detected, refreshing group chats");
            initializeGroupChats();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for group chat creation messages
    const groupChatCreationSub = supabase
      .channel(`group-chat-creation-${userPrefix}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `text=like.%Added ${userEmail} to the group chat%`
        },
        (payload) => {
          console.log("User was added to a group chat:", payload);
          initializeGroupChats();
        }
      )
      .subscribe();

    console.log("Real-time subscriptions active");

    return () => {
      console.log("Cleaning up subscriptions and interval");
      clearInterval(refreshInterval);
      supabase.removeChannel(friendRequestsSub);
      supabase.removeChannel(groupChatMessagesSub);
      supabase.removeChannel(groupChatCreationSub);
    };
  }, [userEmail]);

  const refreshFriendsList = async () => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
      .eq("status", "accepted");

    if (!data || error) return;

    const emails = data.map(req =>
      req.sender_email === userEmail ? req.receiver_email : req.sender_email
    );
    setFriends(emails);
    setFilteredFriends(emails); // Initialize filtered friends with all friends

    const { data: users } = await supabase
      .from("users")
      .select("email, displayname")
      .in("email", emails);

    const nameMap = {};
    users?.forEach(u => {
      nameMap[u.email] = u.displayname || u.email;
    });
    setFriendDisplayNames(nameMap);

    // Apply search filter if there's an active search
    if (searchTerm) {
      handleSearch(searchTerm);
    }
  };

  // Function to initialize group chat state
  const initializeGroupChats = async () => {
    try {
      console.log("Initializing group chats...");

      // Instead of just using localStorage, let's use Supabase for group chats
      // First, check if we have a group_chats table in Supabase
      const { data: groupChatsData, error: groupChatsError } = await supabase
        .from("messages")
        .select("recipient")
        .like("recipient", "group:%")
        .limit(1);

      if (groupChatsError) {
        console.error("Error checking for group chats:", groupChatsError);
      }

      // If we have group chats in Supabase, use them
      if (groupChatsData && groupChatsData.length > 0) {
        console.log("Found group chats in Supabase");

        // Get all unique group chat IDs from messages
        const { data: groupMessages, error: messagesError } = await supabase
          .from("messages")
          .select("recipient, text, sender")
          .like("recipient", "group:%");

        if (messagesError) {
          console.error("Error fetching group messages:", messagesError);
          return false;
        }

        // Extract group IDs and create group chat objects
        const groupChatMap = {};

        groupMessages.forEach(msg => {
          const groupId = msg.recipient.replace("group:", "");
          if (!groupChatMap[groupId]) {
            groupChatMap[groupId] = {
              id: parseInt(groupId),
              name: `Group Chat ${groupId}`, // Default name
              created_by: msg.sender,
              members: []
            };
          }
        });

        // Check localStorage for additional group chat info
        const storedGroupChats = localStorage.getItem('groupChats');
        if (storedGroupChats) {
          const parsedGroupChats = JSON.parse(storedGroupChats);

          // Merge with data from localStorage
          parsedGroupChats.forEach(chat => {
            if (groupChatMap[chat.id]) {
              // Update existing chat with more info
              groupChatMap[chat.id].name = chat.name;
              groupChatMap[chat.id].members = chat.members;
            } else {
              // Add new chat
              groupChatMap[chat.id] = chat;
            }
          });
        }

        // Convert to array and filter to only include chats where user is a member
        const allGroupChats = Object.values(groupChatMap);
        const userGroupChats = allGroupChats.filter(chat =>
          chat.members && chat.members.includes(userEmail)
        );

        setGroupChats(userGroupChats);
        setFilteredGroupChats(userGroupChats);
        console.log("Loaded group chats:", userGroupChats);
      } else {
        // No group chats in Supabase, check localStorage
        const storedGroupChats = localStorage.getItem('groupChats');
        if (storedGroupChats) {
          const parsedGroupChats = JSON.parse(storedGroupChats);

          // Filter to only include group chats where the user is a member
          const userGroupChats = parsedGroupChats.filter(chat =>
            chat.members && chat.members.includes(userEmail)
          );

          setGroupChats(userGroupChats);
          setFilteredGroupChats(userGroupChats);
          console.log("Loaded group chats from localStorage:", userGroupChats);
        } else {
          // Initialize with empty array
          localStorage.setItem('groupChats', JSON.stringify([]));
          setGroupChats([]);
          setFilteredGroupChats([]);
        }
      }

      return true;
    } catch (err) {
      console.error("Error initializing group chats:", err);
      return false;
    }
  };

  // Function to handle search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);

    // Filter friends
    if (friends.length > 0) {
      const filtered = friends.filter(friend => {
        const displayName = friendDisplayNames[friend] || friend;
        return displayName.toLowerCase().includes(searchValue.toLowerCase());
      });
      setFilteredFriends(filtered);
    }

    // Filter group chats
    if (groupChats.length > 0) {
      const filtered = groupChats.filter(chat =>
        chat.name.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredGroupChats(filtered);
    }
  };





  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
    navigate("/login");
  };

  // Handle profile updates
  const handleProfileUpdate = (profileData) => {
    // Update the user name in the UI
    setUserName(profileData.displayname || profileData.name || userEmail);

    // Refresh friends list to update any display name changes
    refreshFriendsList();
  };

  // Handle group chat creation
  const handleGroupChatCreated = (newGroupChat) => {
    // Add the new group chat to state
    setGroupChats(prev => [...prev, newGroupChat]);
    setFilteredGroupChats(prev => [...prev, newGroupChat]);

    // Also save to localStorage
    try {
      const storedGroupChats = localStorage.getItem('groupChats') || '[]';
      const parsedGroupChats = JSON.parse(storedGroupChats);

      // Add the new group chat
      parsedGroupChats.push(newGroupChat);

      // Save back to localStorage
      localStorage.setItem('groupChats', JSON.stringify(parsedGroupChats));
      console.log("Saved new group chat to localStorage:", newGroupChat);

      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('groupChatUpdate', {
        detail: { type: 'create', chat: newGroupChat }
      }));
    } catch (err) {
      console.error("Error saving group chat to localStorage:", err);
    }

    // Update UI state
    setShowGroupChatCreator(false);
    setActiveSection("chat");
    setSelectedFriend("");
    setSelectedGroupChat(newGroupChat);
  };

  // Handle group chat deletion
  const handleDeleteGroupChat = async (groupChatId) => {
    if (!window.confirm("Are you sure you want to delete this group chat? This action cannot be undone.")) {
      return;
    }

    try {
      // Delete from localStorage
      try {
        const storedGroupChats = localStorage.getItem('groupChats') || '[]';
        const parsedGroupChats = JSON.parse(storedGroupChats);

        // Filter out the deleted group chat
        const updatedGroupChats = parsedGroupChats.filter(chat => chat.id !== groupChatId);

        // Save back to localStorage
        localStorage.setItem('groupChats', JSON.stringify(updatedGroupChats));
        console.log("Removed group chat from localStorage:", groupChatId);

        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent('groupChatUpdate', {
          detail: { type: 'delete', chatId: groupChatId }
        }));
      } catch (storageError) {
        console.error("Error updating localStorage:", storageError);
      }

      // Send a message to the group chat to notify members it's been deleted
      try {
        const deleteMessage = {
          text: `Group chat deleted by ${userEmail}`,
          sender: userEmail,
          type: "groupchat",
          recipient: `group:${groupChatId}`,
          created_at: new Date().toISOString()
        };

        await supabase
          .from("messages")
          .insert([deleteMessage]);

        console.log("Sent group chat deletion notification");
      } catch (notifyError) {
        console.error("Error sending deletion notification:", notifyError);
        // Not critical, continue anyway
      }

      // Update state
      setGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));
      setFilteredGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));

      if (selectedGroupChat && selectedGroupChat.id === groupChatId) {
        setSelectedGroupChat(null);
        setActiveSection("home");
      }

      alert("Group chat deleted successfully");
    } catch (error) {
      console.error("Unexpected error deleting group chat:", error);
      alert("An unexpected error occurred");
    }
  };

  // Render content based on active section
  const renderContent = () => {
    if (activeSection === "friends") return <FriendSystem currentUserEmail={userEmail} />;
    if (activeSection === "chat") {
      return (
        <ChatApp
          userEmail={userEmail}
          selectedFriend={selectedFriend}
          selectedGroupChat={selectedGroupChat}
          forceGroupChat={selectedFriend === "" && selectedGroupChat === null}
          onDeleteGroupChat={handleDeleteGroupChat}
        />
      );
    }
    if (showGroupChatCreator) {
      return (
        <GroupChatCreator
          currentUserEmail={userEmail}
          onGroupChatCreated={handleGroupChatCreated}
        />
      );
    }
    return (
      <div className="home-content">
        <div className="welcome-message">
          <h1>Welcome to KeepYapping!</h1>
          <p>Connect with friends, chat with your organization, and create private groups.</p>
        </div>
        <ProfileEditor
          userEmail={userEmail}
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    );
  };

  return (
    <div className="home-container">
      <div className="sidebar">
        <div className="user-profile">
          <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-status">User</div>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className={`nav-item ${activeSection === "home" ? "active" : ""}`} onClick={() => setActiveSection("home")}>
            <div className="nav-icon">🏠</div><div className="nav-text">Home</div>
          </div>

          <div className={`nav-item ${activeSection === "friends" ? "active" : ""}`} onClick={() => setActiveSection("friends")}>
            <div className="nav-icon">👥</div>
            <div className="nav-text">Friends{pendingRequests.length > 0 && ` (${pendingRequests.length})`}</div>
          </div>

          <div className={`nav-item ${showGroupChatCreator ? "active" : ""}`} onClick={() => {
            setShowGroupChatCreator(true);
            setActiveSection("home");
          }}>
            <div className="nav-icon">➕</div>
            <div className="nav-text">Create Group Chat</div>
          </div>

          <div className={`nav-item ${activeSection === "chat" && selectedFriend === "" && selectedGroupChat === null ? "active" : ""}`} onClick={() => {
            setSelectedFriend("");
            setSelectedGroupChat(null);
            setShowGroupChatCreator(false);
            setActiveSection("chat");
          }}>
            <div className="nav-icon">💬</div>
            <div className="nav-text">Global Yappers Chat</div>
          </div>

          <div className="nav-item" onClick={handleLogout}>
            <div className="nav-icon">🚪</div>
            <div className="nav-text">Logout</div>
          </div>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search friends or groups..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="friends-list" style={{ overflowY: "auto", maxHeight: "45%" }}>
          <div className="friends-header">
            <div className="friends-title">Friends — {friends.length}</div>
            <button className="refresh-button" onClick={refreshFriendsList}>🔄</button>
          </div>
          {filteredFriends.map((friend, idx) => (
            <div key={idx} className="friend-item" onClick={() => {
              setSelectedFriend(friend);
              setSelectedGroupChat(null);
              setActiveSection("chat");
            }}>
              <div className="friend-avatar">{friend.charAt(0).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{friendDisplayNames[friend] || friend}</div>
                <div className="friend-status">Online</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 5 }}></div>

        <div className="friends-list" style={{ overflowY: "auto", maxHeight: "45%" }}>
          <div className="friends-header">
            <div className="friends-title">Group Chats — {groupChats.length}</div>
          </div>
          {filteredGroupChats.map((chat) => (
            <div key={chat.id} className="friend-item">
              <div
                className="friend-item-content"
                onClick={() => {
                  setSelectedFriend("");
                  setSelectedGroupChat(chat);
                  setShowGroupChatCreator(false);
                  setActiveSection("chat");
                }}
              >
                <div className="friend-avatar">{chat.name.charAt(0).toUpperCase()}</div>
                <div className="friend-info">
                  <div className="friend-name">{chat.name}</div>
                  <div className="friend-status">Group</div>
                </div>
              </div>
              <button
                className="delete-group-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteGroupChat(chat.id);
                }}
                title="Delete group chat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="content-header">
          <div className="content-title">
            {activeSection === "home" && "Home"}
            {activeSection === "friends" && "Friends"}
            {activeSection === "chat" && (selectedGroupChat ? selectedGroupChat.name : selectedFriend || "Global Yappers Chat")}
          </div>
        </div>
        <div className="content-body">{renderContent()}</div>
      </div>
    </div>
  );
}

export default HomePage;

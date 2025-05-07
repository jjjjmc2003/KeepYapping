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
      console.log("Initializing group chats for user:", userEmail);

      if (!userEmail) {
        console.log("No user email available, skipping group chat initialization");
        return false;
      }

      // 1. Get all group chats where the user is a member using the group_chat_members table
      const { data: memberData, error: memberError } = await supabase
        .from("group_chat_members")
        .select("group_id")
        .eq("member_email", userEmail);

      if (memberError) {
        console.error("Error fetching group chat memberships:", memberError);
        return false;
      }

      if (!memberData || memberData.length === 0) {
        console.log("User is not a member of any group chats");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      // Extract group IDs
      const groupIds = memberData.map(item => item.group_id);
      console.log("User is a member of group chats with IDs:", groupIds);

      // 2. Get details for these group chats
      const { data: groupChatsData, error: groupChatsError } = await supabase
        .from("group_chats")
        .select("*")
        .in("id", groupIds);

      if (groupChatsError) {
        console.error("Error fetching group chat details:", groupChatsError);
        return false;
      }

      if (!groupChatsData || groupChatsData.length === 0) {
        console.log("No group chat details found");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      console.log("Fetched group chat details:", groupChatsData);

      // 3. For each group chat, get its members
      const enhancedGroupChats = await Promise.all(groupChatsData.map(async (chat) => {
        // Get members for this group chat
        const { data: chatMembers, error: membersError } = await supabase
          .from("group_chat_members")
          .select("member_email")
          .eq("group_id", chat.id);

        if (membersError) {
          console.error(`Error fetching members for group chat ${chat.id}:`, membersError);
          return {
            ...chat,
            members: [userEmail] // Default to just the current user
          };
        }

        return {
          ...chat,
          members: chatMembers.map(m => m.member_email)
        };
      }));

      console.log("Enhanced group chats with members:", enhancedGroupChats);

      // 4. Update state with the group chats
      setGroupChats(enhancedGroupChats);
      setFilteredGroupChats(enhancedGroupChats);

      // 5. Also update localStorage for backward compatibility
      try {
        localStorage.setItem('groupChats', JSON.stringify(enhancedGroupChats));
      } catch (storageError) {
        console.error("Error saving group chats to localStorage:", storageError);
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
    // Find the group chat
    const groupChat = groupChats.find(chat => chat.id === groupChatId);
    if (!groupChat) {
      console.error("Group chat not found:", groupChatId);
      return;
    }

    // Check if the current user is the creator
    if (groupChat.creator !== userEmail) {
      alert("Only the creator of the group chat can delete it");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the group chat "${groupChat.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log("Deleting group chat:", groupChatId);

      // 1. First, send a deletion notification message
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

      // 2. Delete members from group_chat_members table
      const { error: membersError } = await supabase
        .from("group_chat_members")
        .delete()
        .eq("group_id", groupChatId);

      if (membersError) {
        console.error("Error deleting group chat members:", membersError);
        // Continue anyway
      } else {
        console.log("Deleted group chat members successfully");
      }

      // 3. Delete the group chat from group_chats table
      const { error: chatError } = await supabase
        .from("group_chats")
        .delete()
        .eq("id", groupChatId);

      if (chatError) {
        console.error("Error deleting group chat:", chatError);
        alert("Failed to delete group chat: " + chatError.message);
        return;
      }

      console.log("Deleted group chat successfully from database");

      // 4. Update localStorage for backward compatibility
      try {
        const storedGroupChats = localStorage.getItem('groupChats') || '[]';
        const parsedGroupChats = JSON.parse(storedGroupChats);

        // Filter out the deleted group chat
        const updatedGroupChats = parsedGroupChats.filter(chat => chat.id !== groupChatId);

        // Save back to localStorage
        localStorage.setItem('groupChats', JSON.stringify(updatedGroupChats));
        console.log("Updated localStorage after group chat deletion");

        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent('groupChatUpdate', {
          detail: { type: 'delete', chatId: groupChatId }
        }));
      } catch (storageError) {
        console.error("Error updating localStorage:", storageError);
      }

      // 5. Update state
      setGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));
      setFilteredGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));

      if (selectedGroupChat && selectedGroupChat.id === groupChatId) {
        setSelectedGroupChat(null);
        setActiveSection("home");
      }

      alert("Group chat deleted successfully");
    } catch (error) {
      console.error("Unexpected error deleting group chat:", error);
      alert("An unexpected error occurred: " + error.message);
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

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 10, marginBottom: 10 }}></div>

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

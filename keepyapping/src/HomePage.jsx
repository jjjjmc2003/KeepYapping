import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/HomePage.css";
import ChatApp from "./ChatApp";
import FriendSystem from "./FriendSystem";
import ProfileEditor from "./ProfileEditor";

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

    refreshFriendsList();
    fetchGroupChats();

    const sub = supabase
      .channel("friends-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          refreshFriendsList();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
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

    const { data: users } = await supabase
      .from("users")
      .select("email, displayname")
      .in("email", emails);

    const nameMap = {};
    users?.forEach(u => {
      nameMap[u.email] = u.displayname || u.email;
    });
    setFriendDisplayNames(nameMap);
  };

  const fetchGroupChats = async () => {
    const { data, error } = await supabase
      .from("group_chat_members")
      .select("group_chat_id, group_chats(name)")
      .eq("member_email", userEmail);

    if (!error && data) {
      setGroupChats(data.map(d => ({
        id: d.group_chat_id,
        name: d.group_chats.name
      })));
    }
  };

  const createGroupChat = async () => {
    const name = prompt("Enter group chat name:");
    if (!name || !name.trim()) return;

    const { data, error } = await supabase
      .from("group_chats")
      .insert({ name })
      .select()
      .single();

    if (data?.id) {
      await supabase
        .from("group_chat_members")
        .insert({ group_chat_id: data.id, member_email: userEmail });

      setGroupChats(prev => [...prev, { id: data.id, name }]);
      alert("Group chat created!");
    } else {
      alert("Error creating group chat.");
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

          <div className="nav-item" onClick={createGroupChat}>
            <div className="nav-icon">➕</div>
            <div className="nav-text">Create Group Chat</div>
          </div>

          <div className={`nav-item ${activeSection === "chat" && selectedFriend === "" && selectedGroupChat === null ? "active" : ""}`} onClick={() => {
            setSelectedFriend("");
            setSelectedGroupChat(null);
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

        <div className="friends-list" style={{ overflowY: "auto", maxHeight: "45%" }}>
          <div className="friends-header">
            <div className="friends-title">Friends — {friends.length}</div>
            <button className="refresh-button" onClick={refreshFriendsList}>🔄</button>
          </div>
          {friends.map((friend, idx) => (
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
          {groupChats.map((chat) => (
            <div key={chat.id} className="friend-item" onClick={() => {
              setSelectedFriend("");
              setSelectedGroupChat(chat);
              setActiveSection("chat");
            }}>
              <div className="friend-avatar">{chat.name.charAt(0).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{chat.name}</div>
                <div className="friend-status">Group</div>
              </div>
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

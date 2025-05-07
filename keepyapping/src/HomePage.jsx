import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/HomePage.css";
import ChatApp from "./ChatApp";
import FriendSystem from "./FriendSystem";
import ProfileEditor from "./ProfileEditor";

// Supabase Setup
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Custom Role Map (same as in ChatApp)
const emailToRole = {
  "ceo@example.com": "CEO",
  "volunteer@example.com": "Volunteer",
  "boardmember@example.com": "Board Member",
  "reptile-caregiver@example.com": "Caregiver",
  "hr@example.com": "HR",
  "dog-caregiver@example.com": "Caregiver",
  "cat-caregiver@example.com": "Caregiver",
  "caregivers@example.com": "Caregiver",
  "headcare@example.com": "Head Caregiver",
  "bird-caregiver@nsae.com": "Caregiver",
  "wildlife-caregiver@nsae.com": "Caregiver",
  "mamal-caregiver@nase.com": "Caregiver",
  "other-caregiver@nase.com": "Caregiver"
};

function getRoleByEmail(email) {
  return emailToRole[email] || "User";
}

function HomePage({ onLogout }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [friends, setFriends] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState("");

  // Fetch user data on component mount
  useEffect(() => {
    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        navigate("/login");
        return;
      }

      setUserEmail(session.user.email);

      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
      } else if (userData) {
        setUserName(userData.displayname || userData.name || userData.email);
      }
    }

    fetchUserData();
  }, [navigate]);

  // Function to refresh friends list
  const refreshFriendsList = async () => {
    if (!userEmail) return;

    console.log("Refreshing sidebar friends list");
    await fetchFriends();
    await fetchPendingRequests();
  };

  // Fetch friends data
  async function fetchFriends() {
    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
        .eq("status", "accepted");

      if (error) {
        console.error("Error fetching friends:", error);
        return;
      }

      if (!data) {
        setFriends([]);
        return;
      }

      // Process friend data
      const friendsList = data.map(req => {
        return req.sender_email === userEmail ? req.receiver_email : req.sender_email;
      });

      setFriends(friendsList);
    } catch (error) {
      console.error("Unexpected error fetching friends:", error);
    }
  }

  async function fetchPendingRequests() {
    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_email", userEmail)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending requests:", error);
        return;
      }

      setPendingRequests(data || []);
    } catch (error) {
      console.error("Unexpected error fetching pending requests:", error);
    }
  }

  // Fetch friends list
  useEffect(() => {
    if (!userEmail) return;

    refreshFriendsList();

    // Set up real-time subscription for friend changes
    const subscription = supabase
      .channel("friend-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        (payload) => {
          fetchFriends();
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userEmail]);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) {
      onLogout(); // Call the onLogout function passed from App.jsx
    }
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
    switch (activeSection) {
      case "home":
        return (
          <div className="home-content">
            <div className="welcome-message">
              <h1>Welcome to KeepYapping!</h1>
              <p>
                Connect with friends, chat with your organization, and create private groups.
                Select an option from the sidebar to get started.
              </p>
            </div>
            <ProfileEditor
              userEmail={userEmail}
              onProfileUpdate={handleProfileUpdate}
            />
          </div>
        );
      case "friends":
        return <FriendSystem currentUserEmail={userEmail} />;
      case "chat":
        return <ChatApp userEmail={userEmail} selectedFriend={selectedFriend} />;
      default:
        return (
          <div className="welcome-message">
            <h1>Welcome to KeepYapping!</h1>
            <p>
              Connect with friends, chat with your organization, and create private groups.
              Select an option from the sidebar to get started.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="home-container">
      {/* Sidebar */}
      <div className="sidebar">
        {/* User profile section */}
        <div className="user-profile">
          <div className="user-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-status">{getRoleByEmail(userEmail)}</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <div
            className={`nav-item ${activeSection === "home" ? "active" : ""}`}
            onClick={() => setActiveSection("home")}
          >
            <div className="nav-icon">🏠</div>
            <div className="nav-text">Home</div>
          </div>

          <div
            className={`nav-item ${activeSection === "friends" ? "active" : ""}`}
            onClick={() => setActiveSection("friends")}
          >
            <div className="nav-icon">👥</div>
            <div className="nav-text">
              Friends
              {pendingRequests.length > 0 && ` (${pendingRequests.length})`}
            </div>
          </div>

          <div
            className={`nav-item ${activeSection === "chat" ? "active" : ""}`}
            onClick={() => setActiveSection("chat")}
          >
            <div className="nav-icon">💬</div>
            <div className="nav-text">Chat</div>
          </div>

          <div
            className="nav-item"
            onClick={handleLogout}
          >
            <div className="nav-icon">🚪</div>
            <div className="nav-text">Logout</div>
          </div>
        </div>

        {/* Friends list */}
        <div className="friends-list">
          <div className="friends-header">
            <div className="friends-title">Friends — {friends.length}</div>
            <button
              className="refresh-button"
              onClick={refreshFriendsList}
              title="Refresh friends list"
            >
              🔄
            </button>
          </div>

          {friends.length === 0 ? (
            <div className="friend-item">
              <div className="friend-info">
                <div className="friend-status">No friends yet</div>
              </div>
            </div>
          ) : (
            friends.map((friend, index) => (
              <div
                key={index}
                className="friend-item"
                onClick={() => {
                  setSelectedFriend(friend);
                  setActiveSection("chat");
                }}
              >
                <div className="friend-avatar">
                  {friend.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{friend}</div>
                  <div className="friend-status">Online</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="main-content">
        <div className="content-header">
          <div className="content-title">
            {activeSection === "home" && "Home"}
            {activeSection === "friends" && "Friends"}
            {activeSection === "chat" && "Chat"}
          </div>
        </div>

        <div className="content-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default HomePage;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/HomePage.css";
import ChatApp from "./ChatApp";
import FriendSystem from "./FriendSystem";
import ProfileEditor from "./ProfileEditor";
import GroupChatCreator from "./GroupChatCreator";
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";
import { useNotifications } from "./NotificationContext";

const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function HomePage({ onLogout }) {
  const navigate = useNavigate();
  const {
    unreadGlobal: unreadGlobalChat,
    unreadFriends: unreadFriendMessages,
    unreadGroups: unreadGroupMessages,
    markAsRead: markChatAsRead
  } = useNotifications();

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userAvatarId, setUserAvatarId] = useState(1); // Default avatar ID
  const [userCustomAvatarUrl, setUserCustomAvatarUrl] = useState(""); // Custom avatar URL
  const [friends, setFriends] = useState([]);
  const [friendDisplayNames, setFriendDisplayNames] = useState({});
  const [friendAvatarIds, setFriendAvatarIds] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [selectedFriend, setSelectedFriend] = useState("");
  const [selectedGroupChat, setSelectedGroupChat] = useState(null);
  const [showGroupChatCreator, setShowGroupChatCreator] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [filteredGroupChats, setFilteredGroupChats] = useState([]);

  // Local state for notifications (in addition to context)
  const [localUnreadFriendMessages, setLocalUnreadFriendMessages] = useState({});
  const [localUnreadGroupMessages, setLocalUnreadGroupMessages] = useState({});

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
        setUserAvatarId(userData.avatar_id || 1); // Default to 1 if not set
        setUserCustomAvatarUrl(userData.custom_avatar_url || ""); // Get custom avatar URL if exists
      }
    }

    fetchUserData();
  }, [navigate]);

  // Function to load last read timestamps from localStorage
  const loadLastReadTimestamps = () => {
    try {
      // Use the same key as NotificationContext
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');

      // Ensure the data structure is complete
      if (!lastReadData.friends) lastReadData.friends = {};
      if (!lastReadData.groups) lastReadData.groups = {};

      return {
        friends: lastReadData.friends,
        groups: lastReadData.groups
      };
    } catch (error) {
      console.error("Error loading last read timestamps:", error);
      return { friends: {}, groups: {} };
    }
  };

  // Custom function to mark chats as read in both context and local state
  const markChatAsReadBoth = (type, id = null) => {
    // First, use the context function to update the notification context
    markChatAsRead(type, id);

    // Then, update our local state
    if (type === 'friend' && id) {
      setLocalUnreadFriendMessages(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      // Also update localStorage directly to ensure timestamps are updated
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      if (!lastReadData.friends) lastReadData.friends = {};
      lastReadData.friends[id] = Date.now();
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for friend ${id} to ${new Date().toISOString()}`);

    } else if (type === 'group' && id) {
      setLocalUnreadGroupMessages(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      // Also update localStorage directly to ensure timestamps are updated
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      if (!lastReadData.groups) lastReadData.groups = {};
      lastReadData.groups[id] = Date.now();
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for group ${id} to ${new Date().toISOString()}`);

    } else if (type === 'global') {
      // Update global chat timestamp
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      lastReadData.global = Date.now();
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for global chat to ${new Date().toISOString()}`);
    }
  };

  // Effect to mark chats as read when they are opened
  useEffect(() => {
    if (activeSection === "chat" && userEmail) {
      console.log("DEBUG: Chat opened - activeSection:", activeSection);
      console.log("DEBUG: Chat opened - selectedFriend:", selectedFriend);
      console.log("DEBUG: Chat opened - selectedGroupChat:", selectedGroupChat);

      if (selectedFriend) {
        console.log("DEBUG: Marking friend chat as read:", selectedFriend);
        markChatAsReadBoth('friend', selectedFriend);
      } else if (selectedGroupChat) {
        console.log("DEBUG: Marking group chat as read:", selectedGroupChat.id);
        markChatAsReadBoth('group', selectedGroupChat.id);
      } else {
        console.log("DEBUG: Marking global chat as read");
        markChatAsReadBoth('global');
      }
    }
  }, [activeSection, selectedFriend, selectedGroupChat, userEmail, markChatAsRead]);

  // Debug effect to log notification state changes
  useEffect(() => {
    console.log("DEBUG: unreadGlobalChat changed:", unreadGlobalChat);
  }, [unreadGlobalChat]);

  useEffect(() => {
    console.log("DEBUG: unreadFriendMessages changed:", unreadFriendMessages);

    // Log the specific friend emails that have unread messages
    if (unreadFriendMessages && Object.keys(unreadFriendMessages).length > 0) {
      console.log("DEBUG: Friends with unread messages:", Object.keys(unreadFriendMessages));
    }
  }, [unreadFriendMessages]);

  useEffect(() => {
    console.log("DEBUG: unreadGroupMessages changed:", unreadGroupMessages);

    // Log the specific group chat IDs that have unread messages
    if (unreadGroupMessages && Object.keys(unreadGroupMessages).length > 0) {
      console.log("DEBUG: Group chats with unread messages:", Object.keys(unreadGroupMessages));
    }
  }, [unreadGroupMessages]);

  // We're now using the NotificationContext for all notification handling

  // Use the markChatAsRead function from the notification context

  useEffect(() => {
    if (!userEmail) return;

    // Initialize app
    const initializeApp = async () => {
      await refreshFriendsList();
      await initializeGroupChats();
      await refreshPendingRequests();
    };

    initializeApp();

    // Set up periodic refresh for friends, group chats, and pending requests
    const refreshInterval = setInterval(async () => {
      console.log("Periodic refresh of friends, group chats, and pending requests");
      await refreshFriendsList();
      await initializeGroupChats();
      await refreshPendingRequests();
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
          refreshGroups(); // Update the notification context
        }
      )
      .subscribe();

    console.log("Real-time subscriptions active");

    return () => {
      console.log("Cleaning up subscriptions and interval");
      clearInterval(refreshInterval);
      supabase.removeChannel(friendRequestsSub);
      supabase.removeChannel(groupChatCreationSub);
    };
  }, [userEmail]);

  const refreshFriendsList = async () => {
    try {
      console.log("DEBUG: Refreshing friends list for user:", userEmail);

      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
        .eq("status", "accepted");

      if (!data || error) {
        console.error("DEBUG: Error fetching friend requests:", error);
        return [];
      }

      const emails = data.map(req =>
        req.sender_email === userEmail ? req.receiver_email : req.sender_email
      );
      console.log("DEBUG: Found friends:", emails);

      setFriends(emails);
      setFilteredFriends(emails); // Initialize filtered friends with all friends

      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id, custom_avatar_url")
        .in("email", emails);

      if (usersError) {
        console.error("DEBUG: Error fetching user details for friends:", usersError);
      }

      const nameMap = {};
      const avatarMap = {};
      const customAvatarMap = {};
      users?.forEach(u => {
        nameMap[u.email] = u.displayname || u.email;
        avatarMap[u.email] = u.avatar_id || 1; // Default to 1 if not set

        // Store custom avatar URLs in a separate state
        if (u.avatar_id === CUSTOM_AVATAR_ID && u.custom_avatar_url) {
          customAvatarMap[u.email] = u.custom_avatar_url;
        }
      });
      setFriendDisplayNames(nameMap);
      setFriendAvatarIds(avatarMap);

      // Store custom avatar URLs in localStorage for easy access across components
      localStorage.setItem('friendCustomAvatars', JSON.stringify(customAvatarMap));

      // Apply search filter if there's an active search
      if (searchTerm) {
        handleSearch(searchTerm);
      }

      // Check for unread messages from these friends
      try {
        const lastReadTimestamps = loadLastReadTimestamps();
        const lastReadFriends = lastReadTimestamps.friends || {};

        console.log("DEBUG: Checking for unread messages from friends with last read timestamps:", lastReadFriends);

        await checkForNewFriendMessages(lastReadFriends);
      } catch (error) {
        console.error("DEBUG: Error checking for unread friend messages during refresh:", error);
      }

      return emails; // Return the friends list for use in other functions
    } catch (error) {
      console.error("DEBUG: Error refreshing friends list:", error);
      return [];
    }
  };

  // Function to initialize group chat state
  const initializeGroupChats = async () => {
    try {
      console.log("DEBUG: Initializing group chats for user:", userEmail);

      if (!userEmail) {
        console.log("DEBUG: No user email available, skipping group chat initialization");
        return false;
      }

      // 1. Get all group chats where the user is a member using the group_chat_members table
      const { data: memberData, error: memberError } = await supabase
        .from("group_chat_members")
        .select("group_id")
        .eq("member_email", userEmail);

      if (memberError) {
        console.error("DEBUG: Error fetching group chat memberships:", memberError);
        return false;
      }

      if (!memberData || memberData.length === 0) {
        console.log("DEBUG: User is not a member of any group chats");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      // Extract group IDs
      const groupIds = memberData.map(item => item.group_id);
      console.log("DEBUG: User is a member of group chats with IDs:", groupIds);

      // 2. Get details for these group chats
      const { data: groupChatsData, error: groupChatsError } = await supabase
        .from("group_chats")
        .select("*")
        .in("id", groupIds);

      if (groupChatsError) {
        console.error("DEBUG: Error fetching group chat details:", groupChatsError);
        return false;
      }

      if (!groupChatsData || groupChatsData.length === 0) {
        console.log("DEBUG: No group chat details found");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      console.log("DEBUG: Fetched group chat details:", groupChatsData);

      // 3. For each group chat, get its members
      const enhancedGroupChats = await Promise.all(groupChatsData.map(async (chat) => {
        // Get members for this group chat
        const { data: chatMembers, error: membersError } = await supabase
          .from("group_chat_members")
          .select("member_email")
          .eq("group_id", chat.id);

        if (membersError) {
          console.error(`DEBUG: Error fetching members for group chat ${chat.id}:`, membersError);
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

      console.log("DEBUG: Enhanced group chats with members:", enhancedGroupChats);

      // 4. Update state with the group chats
      setGroupChats(enhancedGroupChats);
      setFilteredGroupChats(enhancedGroupChats);

      // 5. Also update localStorage for backward compatibility
      try {
        localStorage.setItem('groupChats', JSON.stringify(enhancedGroupChats));
      } catch (storageError) {
        console.error("DEBUG: Error saving group chats to localStorage:", storageError);
      }

      // 6. Check for unread messages in these group chats
      try {
        const lastReadTimestamps = loadLastReadTimestamps();
        const lastReadGroups = lastReadTimestamps.groups || {};

        console.log("DEBUG: Checking for unread messages in group chats with last read timestamps:", lastReadGroups);

        await checkForNewGroupMessages(lastReadGroups);
      } catch (error) {
        console.error("DEBUG: Error checking for unread group messages during initialization:", error);
      }

      return true;
    } catch (err) {
      console.error("DEBUG: Error initializing group chats:", err);
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

    // Update avatar ID if provided
    if (profileData.avatar_id) {
      setUserAvatarId(profileData.avatar_id);
    }

    // Update custom avatar URL if provided
    if (profileData.custom_avatar_url !== undefined) {
      setUserCustomAvatarUrl(profileData.custom_avatar_url);
    }

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

  // Handle leaving a group chat
  const handleLeaveGroupChat = async (groupChatId) => {
    // Find the group chat
    const groupChat = groupChats.find(chat => chat.id === groupChatId);
    if (!groupChat) {
      console.error("Group chat not found:", groupChatId);
      return;
    }

    if (!window.confirm(`Are you sure you want to leave the group chat "${groupChat.name}"?`)) {
      return;
    }

    try {
      console.log("Leaving group chat:", groupChatId);

      // 1. First, send a message to notify other members
      try {
        const leaveMessage = {
          text: `${userEmail} has left the group chat`,
          sender: userEmail,
          type: "groupchat",
          recipient: `group:${groupChatId}`,
          created_at: new Date().toISOString()
        };

        await supabase
          .from("messages")
          .insert([leaveMessage]);

        console.log("Sent group chat leave notification");
      } catch (notifyError) {
        console.error("Error sending leave notification:", notifyError);
        // Not critical, continue anyway
      }

      // 2. Remove the user from the group_chat_members table
      const { error: memberError } = await supabase
        .from("group_chat_members")
        .delete()
        .eq("group_id", groupChatId)
        .eq("member_email", userEmail);

      if (memberError) {
        console.error("Error removing user from group chat:", memberError);
        alert("Failed to leave group chat: " + memberError.message);
        return;
      }

      console.log("Successfully left group chat");

      // 3. Update localStorage for backward compatibility
      try {
        const storedGroupChats = localStorage.getItem('groupChats') || '[]';
        const parsedGroupChats = JSON.parse(storedGroupChats);

        // Filter out the group chat the user left
        const updatedGroupChats = parsedGroupChats.filter(chat => chat.id !== groupChatId);

        // Save back to localStorage
        localStorage.setItem('groupChats', JSON.stringify(updatedGroupChats));
        console.log("Updated localStorage after leaving group chat");

        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent('groupChatUpdate', {
          detail: { type: 'leave', chatId: groupChatId, userEmail: userEmail }
        }));
      } catch (storageError) {
        console.error("Error updating localStorage:", storageError);
      }

      // 4. Update state
      setGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));
      setFilteredGroupChats(prev => prev.filter(chat => chat.id !== groupChatId));

      if (selectedGroupChat && selectedGroupChat.id === groupChatId) {
        setSelectedGroupChat(null);
        setActiveSection("home");
      }

      alert("You have left the group chat");
    } catch (error) {
      console.error("Unexpected error leaving group chat:", error);
      alert("An unexpected error occurred: " + error.message);
    }
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

  // We're now using the NotificationContext for membership checks

  // Function to check for new friend messages
  const checkForNewFriendMessages = async (lastReadTimestamps) => {
    if (!userEmail || !lastReadTimestamps) return;

    try {
      // For each friend, check if there are any unread messages
      for (const friendEmail of Object.keys(lastReadTimestamps)) {
        const lastReadTime = lastReadTimestamps[friendEmail] || 0;

        // Skip if we're currently viewing this friend's chat
        if (activeSection === "chat" && selectedFriend === friendEmail) {
          console.log(`DEBUG: Skipping unread check for friend ${friendEmail} (currently viewing)`);
          continue;
        }

        // Query for messages from this friend that are newer than the last read timestamp
        // We need to check both directions (messages from friend to user and from user to friend)
        const { data, error } = await supabase
          .from("messages")
          .select("created_at, sender, recipient")
          .eq("type", "dm")
          .or(`and(sender.eq.${friendEmail},recipient.eq.${userEmail}),and(sender.eq.${userEmail},recipient.eq.${friendEmail})`)
          .gt("created_at", new Date(lastReadTime).toISOString())
          .neq("sender", userEmail) // Only count messages FROM the friend, not from the current user
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error(`DEBUG: Error checking for new messages from ${friendEmail}:`, error);
          continue;
        }

        // If there are unread messages, update the unread state
        if (data && data.length > 0) {
          console.log(`DEBUG: Found unread messages from ${friendEmail}`);

          // Update the local notification state
          const newUnreadFriendMessages = {...localUnreadFriendMessages};
          newUnreadFriendMessages[friendEmail] = true;

          // This is a direct state update, not using the context
          // We're doing this because we need to update the UI immediately
          setLocalUnreadFriendMessages(newUnreadFriendMessages);
        }
      }
    } catch (error) {
      console.error("DEBUG: Error checking for new friend messages:", error);
    }
  };

  // Function to check for new group messages
  const checkForNewGroupMessages = async (lastReadTimestamps) => {
    if (!userEmail || !lastReadTimestamps) return;

    try {
      // For each group, check if there are any unread messages
      for (const groupId of Object.keys(lastReadTimestamps)) {
        const lastReadTime = lastReadTimestamps[groupId] || 0;

        // Skip if we're currently viewing this group chat
        if (activeSection === "chat" && selectedGroupChat && selectedGroupChat.id === groupId) {
          console.log(`DEBUG: Skipping unread check for group ${groupId} (currently viewing)`);
          continue;
        }

        // Query for messages in this group that are newer than the last read timestamp
        const { data, error } = await supabase
          .from("messages")
          .select("created_at, sender")
          .eq("recipient", `group:${groupId}`)
          .eq("type", "groupchat")
          .gt("created_at", new Date(lastReadTime).toISOString())
          .neq("sender", userEmail) // Only count messages from others, not from the current user
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error(`DEBUG: Error checking for new messages in group ${groupId}:`, error);
          continue;
        }

        // If there are unread messages, update the unread state
        if (data && data.length > 0) {
          console.log(`DEBUG: Found unread messages in group ${groupId}`);

          // Update the local notification state
          const newUnreadGroupMessages = {...localUnreadGroupMessages};
          newUnreadGroupMessages[groupId] = true;

          // This is a direct state update, not using the context
          // We're doing this because we need to update the UI immediately
          setLocalUnreadGroupMessages(newUnreadGroupMessages);
        }
      }
    } catch (error) {
      console.error("DEBUG: Error checking for new group messages:", error);
    }
  };

  // Function to refresh pending friend requests
  const refreshPendingRequests = async () => {
    try {
      if (!userEmail) return;

      console.log("Refreshing pending friend requests");

      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_email", userEmail)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending requests:", error);
        return;
      }

      console.log("Pending requests:", data);
      setPendingRequests(data || []);
    } catch (error) {
      console.error("Error refreshing pending requests:", error);
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
          onLeaveGroupChat={handleLeaveGroupChat}
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
          <div className="user-avatar">
            {userAvatarId === CUSTOM_AVATAR_ID && userCustomAvatarUrl ? (
              <img
                src={userCustomAvatarUrl}
                alt={userName}
              />
            ) : userAvatarId ? (
              <img
                src={avatars.find(a => a.id === userAvatarId)?.url || avatars[0].url}
                alt={userName}
              />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
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
            <div className="nav-text">
              Friends
              {pendingRequests.length > 0 && ` (${pendingRequests.length})`}
            </div>
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
            <div className="nav-text">
              Global Yappers Chat
              {unreadGlobalChat && !(activeSection === "chat" && selectedFriend === "" && selectedGroupChat === null) && (
                <span style={{ color: '#ff5555', fontWeight: 'bold', marginLeft: '5px' }}>
                  (New)
                </span>
              )}
            </div>
          </div>

          <div className="nav-item" onClick={handleLogout}>
            <div className="nav-icon">🚪</div>
            <div className="nav-text">Logout</div>
          </div>

          {/* Debug buttons - only visible in development */}
          {process.env.NODE_ENV !== 'production' && (
            <>
              <div className="nav-item" onClick={() => {
                console.log("DEBUG: Manual notification check triggered");
                console.log("DEBUG: Current notification states:");
                console.log("- Context unreadGlobalChat:", unreadGlobalChat);
                console.log("- Context unreadFriendMessages:", unreadFriendMessages);
                console.log("- Context unreadGroupMessages:", unreadGroupMessages);
                console.log("- Local unreadFriendMessages:", localUnreadFriendMessages);
                console.log("- Local unreadGroupMessages:", localUnreadGroupMessages);

                // Show an alert with the current notification states
                alert(
                  "Current notification states:\n" +
                  "- Global chat: " + (unreadGlobalChat ? "Unread" : "Read") + "\n" +
                  "- Friend chats (context): " + Object.keys(unreadFriendMessages || {}).length + " unread\n" +
                  "- Friend chats (local): " + Object.keys(localUnreadFriendMessages || {}).length + " unread\n" +
                  "- Group chats (context): " + Object.keys(unreadGroupMessages || {}).length + " unread\n" +
                  "- Group chats (local): " + Object.keys(localUnreadGroupMessages || {}).length + " unread"
                );
              }}>
                <div className="nav-icon">🐞</div>
                <div className="nav-text">Debug Notifications</div>
              </div>

              <div className="nav-item" onClick={() => {
                // Manually set notification states for testing using the NotificationContext
                console.log("DEBUG: Manually setting notification states for testing");

                // Only set notifications for chats the user is not currently viewing
                const isViewingGlobalChat = activeSection === "chat" && !selectedFriend && !selectedGroupChat;

                // Only set notifications for chats the user is not currently viewing
                if (!isViewingGlobalChat) {
                  // Set global chat notification if not viewing global chat
                  const LS_KEY = 'yap_last_read';
                  const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
                  lastReadData.global = 0; // Set to 0 to ensure it's marked as unread
                  localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
                  console.log("DEBUG: Set test notification for global chat");

                  // Set friend notifications if there are friends
                  if (friends && friends.length > 0) {
                    const testFriendNotifications = {};

                    // Set notifications for all friends except the one being viewed
                    friends.forEach(friend => {
                      // Skip if viewing this friend's chat
                      if (activeSection === "chat" && selectedFriend === friend) {
                        console.log(`DEBUG: Skipping notification for friend ${friend} (currently viewing)`);
                        return;
                      }

                      testFriendNotifications[friend] = true;
                      console.log(`DEBUG: Set test notification for friend ${friend}`);
                    });

                    if (Object.keys(testFriendNotifications).length > 0) {
                      // Update both the context and local state
                      Object.keys(testFriendNotifications).forEach(friend => {
                        // Update the lastRead timestamp in localStorage
                        const lastReadData = JSON.parse(localStorage.getItem(`lastRead_${userEmail}`) || '{}');
                        if (!lastReadData.friends) lastReadData.friends = {};
                        lastReadData.friends[friend] = 0; // Set to 0 to ensure it's marked as unread
                        localStorage.setItem(`lastRead_${userEmail}`, JSON.stringify(lastReadData));

                        // Also update the local state directly
                        setLocalUnreadFriendMessages(prev => ({
                          ...prev,
                          [friend]: true
                        }));
                      });

                      console.log(`DEBUG: Set test notifications for ${Object.keys(testFriendNotifications).length} friends`);
                    }
                  }

                  // Set group chat notifications if there are group chats
                  if (groupChats && groupChats.length > 0) {
                    const testGroupNotifications = {};

                    // Set notifications for all group chats except the one being viewed
                    groupChats.forEach(chat => {
                      // Skip if viewing this group chat
                      if (activeSection === "chat" && selectedGroupChat && selectedGroupChat.id === chat.id) {
                        console.log(`DEBUG: Skipping notification for group chat ${chat.id} (${chat.name}) (currently viewing)`);
                        return;
                      }

                      testGroupNotifications[chat.id] = true;
                      console.log(`DEBUG: Set test notification for group chat ${chat.id} (${chat.name})`);
                    });

                    if (Object.keys(testGroupNotifications).length > 0) {
                      // Update both the context and local state
                      Object.keys(testGroupNotifications).forEach(groupId => {
                        // Update the lastRead timestamp in localStorage
                        const lastReadData = JSON.parse(localStorage.getItem(`lastRead_${userEmail}`) || '{}');
                        if (!lastReadData.groups) lastReadData.groups = {};
                        lastReadData.groups[groupId] = 0; // Set to 0 to ensure it's marked as unread
                        localStorage.setItem(`lastRead_${userEmail}`, JSON.stringify(lastReadData));

                        // Also update the local state directly
                        setLocalUnreadGroupMessages(prev => ({
                          ...prev,
                          [groupId]: true
                        }));
                      });

                      console.log(`DEBUG: Set test notifications for ${Object.keys(testGroupNotifications).length} group chats`);
                    }
                  }

                  // Refresh to show the notifications
                  refreshFriendsList();
                  initializeGroupChats();
                }

                // Show an alert to confirm
                alert("Notification refresh triggered. Check the console for details.");
              }}>
                <div className="nav-icon">🧪</div>
                <div className="nav-text">Test Notifications</div>
              </div>
            </>
          )}
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
            <div className="friends-title">
              Friends — {friends.length}
              {((unreadFriendMessages && Object.keys(unreadFriendMessages).length > 0) ||
                (localUnreadFriendMessages && Object.keys(localUnreadFriendMessages).length > 0)) && (
                <span style={{ color: '#ff5555', fontWeight: 'bold', marginLeft: '5px' }}>
                  (New: {Math.max(
                    Object.keys(unreadFriendMessages || {}).length,
                    Object.keys(localUnreadFriendMessages || {}).length
                  )})
                </span>
              )}
            </div>
          </div>
          {filteredFriends.map((friend) => (
            <div key={friend} className="friend-item" onClick={() => {
              setSelectedFriend(friend);
              setSelectedGroupChat(null);
              setActiveSection("chat");
            }}>
              <div className="friend-avatar">
                {friendAvatarIds[friend] === CUSTOM_AVATAR_ID ? (
                  // Get custom avatar URL from localStorage
                  <img
                    src={JSON.parse(localStorage.getItem('friendCustomAvatars') || '{}')[friend]}
                    alt={friendDisplayNames[friend] || friend}
                  />
                ) : friendAvatarIds[friend] ? (
                  <img
                    src={avatars.find(a => a.id === friendAvatarIds[friend])?.url || avatars[0].url}
                    alt={friendDisplayNames[friend] || friend}
                  />
                ) : (
                  (friendDisplayNames[friend] || friend).charAt(0).toUpperCase()
                )}
              </div>
              <div className="friend-info">
                <div className="friend-name">
                  {friendDisplayNames[friend] || friend}
                  {((unreadFriendMessages && unreadFriendMessages[friend]) ||
                    (localUnreadFriendMessages && localUnreadFriendMessages[friend])) && (
                    <span style={{ color: '#ff5555', fontWeight: 'bold', marginLeft: '5px' }}>
                      (New)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 10, marginBottom: 10 }}></div>

        <div className="friends-list" style={{ overflowY: "auto", maxHeight: "45%" }}>
          <div className="friends-header">
            <div className="friends-title">
              Group Chats — {groupChats.length}
              {((unreadGroupMessages && Object.keys(unreadGroupMessages).length > 0) ||
                (localUnreadGroupMessages && Object.keys(localUnreadGroupMessages).length > 0)) && (
                <span style={{ color: '#ff5555', fontWeight: 'bold', marginLeft: '5px' }}>
                  (New: {Math.max(
                    Object.keys(unreadGroupMessages || {}).length,
                    Object.keys(localUnreadGroupMessages || {}).length
                  )})
                </span>
              )}
            </div>
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
                <div className="friend-avatar">
                  {chat.name.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <div className="friend-name">
                    {chat.name}
                    {((unreadGroupMessages && unreadGroupMessages[chat.id]) ||
                      (localUnreadGroupMessages && localUnreadGroupMessages[chat.id])) && (
                      <span style={{ color: '#ff5555', fontWeight: 'bold', marginLeft: '5px' }}>
                        (New)
                      </span>
                    )}
                  </div>
                  <div className="friend-status">Group</div>
                </div>
              </div>
              {chat.creator === userEmail && (
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
              )}
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

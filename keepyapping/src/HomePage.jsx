import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as SupabaseClient from "@supabase/supabase-js";
import "../styles/HomePage.css";
import ChatApp from "./ChatApp";
import FriendSystem from "./FriendSystem";
import ProfileEditor from "./ProfileEditor";
import GroupChatCreator from "./GroupChatCreator";
import avatars, { CUSTOM_AVATAR_ID } from "./avatars";
import { useNotifications } from "./NotificationContext";

// Connection details for our Supabase database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
// Create a Supabase client we'll use throughout the component
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Debounce function to prevent rapid state updates
 * This helps prevent UI flickering by limiting how often state updates occur
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} - The debounced function
 */
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Main component for the home page - this is what users see after logging in
function HomePage({ onLogout }) {
  // Hook for navigating between pages
  const navigate = useNavigate();

  // Get notification data from our notification context
  const {
    unreadGlobal: unreadGlobalChat,
    unreadFriends: unreadFriendMessages,
    unreadGroups: unreadGroupMessages,
    markAsRead: markChatAsRead
  } = useNotifications();

  // User information state
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userAvatarId, setUserAvatarId] = useState(1);
  const [userCustomAvatarUrl, setUserCustomAvatarUrl] = useState("");

  // Friends state
  const [friends, setFriends] = useState([]);
  const [friendDisplayNames, setFriendDisplayNames] = useState({});
  const [friendAvatarIds, setFriendAvatarIds] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);

  // Group chats state
  const [groupChats, setGroupChats] = useState([]);

  // UI navigation state
  const [activeSection, setActiveSection] = useState("home");
  const [selectedFriend, setSelectedFriend] = useState("");
  const [selectedGroupChat, setSelectedGroupChat] = useState(null);
  const [showGroupChatCreator, setShowGroupChatCreator] = useState(false);

  // Search functionality state
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [filteredGroupChats, setFilteredGroupChats] = useState([]);

  // Local notification state (in addition to context)
  // We use both for redundancy and to ensure notifications work correctly
  const [localUnreadFriendMessages, setLocalUnreadFriendMessages] = useState({});
  const [localUnreadGroupMessages, setLocalUnreadGroupMessages] = useState({});

  // Refs to store current state values for use in debounced functions
  const localUnreadFriendMessagesRef = useRef(localUnreadFriendMessages);
  const localUnreadGroupMessagesRef = useRef(localUnreadGroupMessages);

  // Update refs when state changes
  useEffect(() => {
    localUnreadFriendMessagesRef.current = localUnreadFriendMessages;
  }, [localUnreadFriendMessages]);

  useEffect(() => {
    localUnreadGroupMessagesRef.current = localUnreadGroupMessages;
  }, [localUnreadGroupMessages]);

  // Debounced state update functions to prevent flickering
  const debouncedSetLocalUnreadFriendMessages = useCallback(
    debounce((newState) => {
      setLocalUnreadFriendMessages(newState);
    }, 300), // 300ms debounce time
    []
  );

  const debouncedSetLocalUnreadGroupMessages = useCallback(
    debounce((newState) => {
      setLocalUnreadGroupMessages(newState);
    }, 300), // 300ms debounce time
    []
  );

  // This effect runs when the component mounts to load the user's data
  useEffect(() => {
    // Function to fetch the current user's data from Supabase
    async function fetchUserData() {
      // Check if there's an active session (user is logged in)
      const { data: { session } } = await supabase.auth.getSession();

      // If no session or no user email, redirect to login page
      if (!session?.user?.email) return navigate("/login");

      // Get the user's email from the session
      const email = session.user.email;
      setUserEmail(email); // Store the email in state

      // Get the user's profile data from the database
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      // If we found user data, update the state with it
      if (userData) {
        // Set the user's display name (fall back to name or email if no display name)
        setUserName(userData.displayname || userData.name || userData.email);
        // Set the user's avatar ID (default to 1 if not set)
        setUserAvatarId(userData.avatar_id || 1);
        // Set the custom avatar URL if the user has one
        setUserCustomAvatarUrl(userData.custom_avatar_url || "");
      }
    }

    // Call the function to load the user data
    fetchUserData();
  }, [navigate]); // Re-run if navigate changes (unlikely)

  // Helper function to get the timestamps of when the user last read each chat
  // We use these timestamps to determine which chats have unread messages
  const loadLastReadTimestamps = () => {
    try {
      // Use the same key as NotificationContext for consistency
      const LS_KEY = 'yap_last_read';
      // Get the stored data from localStorage, or use default empty structure if none exists
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');

      // Make sure all the expected properties exist
      if (!lastReadData.friends) lastReadData.friends = {};
      if (!lastReadData.groups) lastReadData.groups = {};

      // Return just the friends and groups timestamps (we handle global separately)
      return {
        friends: lastReadData.friends,
        groups: lastReadData.groups
      };
    } catch (error) {
      // If there's any error (like invalid JSON), log it and return empty objects
      console.error("Error loading last read timestamps:", error);
      return { friends: {}, groups: {} };
    }
  };

  // Function to mark a chat as read when the user views it
  // This updates both the notification context and our local state
  const markChatAsReadBoth = (type, id = null) => {
    // First, use the context function to update the global notification state
    markChatAsRead(type, id);

    // Then, update our local state for redundancy
    if (type === 'friend' && id) {
      // For friend chats, remove this friend from the unread list
      const newUnreadFriendMessages = { ...localUnreadFriendMessagesRef.current };
      delete newUnreadFriendMessages[id];
      debouncedSetLocalUnreadFriendMessages(newUnreadFriendMessages);

      // Also update localStorage directly with the current timestamp
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      if (!lastReadData.friends) lastReadData.friends = {};
      lastReadData.friends[id] = Date.now();
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for friend ${id} to ${new Date().toISOString()}`);

    } else if (type === 'group' && id) {
      // For group chats, remove this group from the unread list
      const newUnreadGroupMessages = { ...localUnreadGroupMessagesRef.current };
      delete newUnreadGroupMessages[id];
      debouncedSetLocalUnreadGroupMessages(newUnreadGroupMessages);

      // Also update localStorage directly with the current timestamp
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      if (!lastReadData.groups) lastReadData.groups = {};
      // Set the current time as last read
      lastReadData.groups[id] = Date.now();
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for group ${id} to ${new Date().toISOString()}`);

    } else if (type === 'global') {
      // For global chat, update the global timestamp
      const LS_KEY = 'yap_last_read';
      const lastReadData = JSON.parse(localStorage.getItem(`${LS_KEY}_${userEmail}`) || '{"global":0,"friends":{},"groups":{}}');
      lastReadData.global = Date.now(); // Set the current time as last read
      localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(lastReadData));
      console.log(`DEBUG: Updated lastRead timestamp for global chat to ${new Date().toISOString()}`);
    }
  };

  // This effect automatically marks chats as read when the user opens them
  useEffect(() => {
    // Only run this if we're in the chat section and have a valid user
    if (activeSection === "chat" && userEmail) {
      // Log which chat is being opened for debugging
      console.log("DEBUG: Chat opened - activeSection:", activeSection);
      console.log("DEBUG: Chat opened - selectedFriend:", selectedFriend);
      console.log("DEBUG: Chat opened - selectedGroupChat:", selectedGroupChat);

      // Case: A friend's direct message chat is open
      if (selectedFriend) {
        console.log("DEBUG: Marking friend chat as read:", selectedFriend);
        // Mark this friend's chat as read
        markChatAsReadBoth('friend', selectedFriend);
      }
      // Case: A group chat is open
      else if (selectedGroupChat) {
        console.log("DEBUG: Marking group chat as read:", selectedGroupChat.id);
        markChatAsReadBoth('group', selectedGroupChat.id);
      }
      // Case: The global chat is open (no friend or group selected)
      else {
        console.log("DEBUG: Marking global chat as read");
        markChatAsReadBoth('global');
      }
    }
  }, [activeSection, selectedFriend, selectedGroupChat, userEmail, markChatAsRead]);
  // Re-run this effect when any of these values change

  // Debug effect to log when global chat notification state changes
  // This helps us track notification system behavior
  useEffect(() => {
    console.log("DEBUG: unreadGlobalChat changed:", unreadGlobalChat);
  }, [unreadGlobalChat]);

  // Debug effect to log when friend notifications change
  useEffect(() => {
    console.log("DEBUG: unreadFriendMessages changed:", unreadFriendMessages);

    // Log which specific friends have unread messages
    if (unreadFriendMessages && Object.keys(unreadFriendMessages).length > 0) {
      console.log("DEBUG: Friends with unread messages:", Object.keys(unreadFriendMessages));
    }
  }, [unreadFriendMessages]);

  // Debug effect to log when group chat notifications change
  useEffect(() => {
    console.log("DEBUG: unreadGroupMessages changed:", unreadGroupMessages);

    // Log which specific group chats have unread messages
    if (unreadGroupMessages && Object.keys(unreadGroupMessages).length > 0) {
      console.log("DEBUG: Group chats with unread messages:", Object.keys(unreadGroupMessages));
    }
  }, [unreadGroupMessages]);

  // Note: We're using the NotificationContext for all notification handling
  // These local state variables provide redundancy and immediate UI updates

  // This is the main initialization effect that runs when the user email is available
  // It sets up real-time updates and periodic refreshes for friends and group chats
  useEffect(() => {
    // Don't do anything if we don't have a user email yet
    if (!userEmail) return;

    // Function to initialize all the app data
    const initializeApp = async () => {
      await refreshFriendsList();
      await initializeGroupChats();
      await refreshPendingRequests();
    };

    // Run the initialization
    initializeApp();

    // Set up a timer to periodically refresh all data
    // This ensures the UI stays up-to-date even if real-time updates fail
    // Using a longer interval to reduce UI flickering
    const refreshInterval = setInterval(async () => {
      console.log("Periodic refresh of friends, group chats, and pending requests");
      await refreshFriendsList();
      await initializeGroupChats();
      await refreshPendingRequests();
      // Refresh every 15 seconds instead of 5 to reduce UI updates
    }, 15000);

    // Create a unique prefix for channel names based on the user's email
    // This prevents conflicts with other users' channels
    const userPrefix = userEmail.replace(/[^a-zA-Z0-9]/g, '');

    // Set up real-time subscription for friend requests
    // This will update the UI immediately when friend request status changes
    console.log("Setting up real-time subscription for friend requests");
    const friendRequestsSub = supabase
      .channel(`friend-requests-${userPrefix}`)
      // Listen for changes to requests sent by this user
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `sender_email=eq.${userEmail}`
        },
        (payload) => {
          // When a change is detected, refresh the friends list
          console.log("Friend request from current user updated:", payload);
          refreshFriendsList();
        }
      )
      // Also listen for changes to requests received by this user
      .on(
        // Listen for database changes
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_email=eq.${userEmail}`
        },
        (payload) => {
          // When a change is detected, refresh the friends list
          console.log("Friend request to current user updated:", payload);
          refreshFriendsList();
        }
      )
      .subscribe();

    // Set up real-time subscription for when the user is added to a group chat
    // This detects special system messages that indicate group chat additions
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
          // When the user is added to a group, refresh group chats
          console.log("User was added to a group chat:", payload);
          initializeGroupChats();
          refreshGroups();
        }
      )
      .subscribe();

    console.log("Real-time subscriptions active");

    // Clean up function that runs when the component unmounts
    // or when userEmail changes
    return () => {
      console.log("Cleaning up subscriptions and interval");
      clearInterval(refreshInterval);
      supabase.removeChannel(friendRequestsSub);
      supabase.removeChannel(groupChatCreationSub);
    };
  }, [userEmail]);

  // Function to load the user's friends list and their details
  const refreshFriendsList = async () => {
    try {
      console.log("DEBUG: Refreshing friends list for user:", userEmail);

      //Get all accepted friend requests involving this user
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
        .eq("status", "accepted");

      // Handle errors or no data
      if (!data || error) {
        console.error("DEBUG: Error fetching friend requests:", error);
        return [];
      }

      //Extract the email addresses of all friends
      // For each request, get the email of the other person (not the current user)
      const emails = data.map(req =>
        req.sender_email === userEmail ? req.receiver_email : req.sender_email
      );
      console.log("DEBUG: Found friends:", emails);

      // Update state with the list of friend emails
      setFriends(emails);
      setFilteredFriends(emails);

      // Get additional details for each friend (display name, avatar)
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("email, displayname, avatar_id, custom_avatar_url")
        .in("email", emails);
      // Handle errors getting user details
      if (usersError) {
        console.error("DEBUG: Error fetching user details for friends:", usersError);
      }

      // Create maps for display names, avatar IDs, and custom avatars
      const nameMap = {};
      const avatarMap = {};
      const customAvatarMap = {};

      // Process each user and fill the maps
      users?.forEach(u => {
        // Use display name or fall back to email
        nameMap[u.email] = u.displayname || u.email;
        // Default to avatar 1 if not set
        avatarMap[u.email] = u.avatar_id || 1;

        // Store custom avatar URLs separately
        if (u.avatar_id === CUSTOM_AVATAR_ID && u.custom_avatar_url) {
          customAvatarMap[u.email] = u.custom_avatar_url;
        }
      });

      // Update state with the maps
      setFriendDisplayNames(nameMap);
      setFriendAvatarIds(avatarMap);

      // Store custom avatar URLs in localStorage for easy access across components
      localStorage.setItem('friendCustomAvatars', JSON.stringify(customAvatarMap));

      // Step 5: Apply search filter if there's an active search
      if (searchTerm) {
        handleSearch(searchTerm);
      }

      // Step 6: Check for unread messages from these friends
      try {
        // Get the timestamps of when the user last read each friend's messages
        const lastReadTimestamps = loadLastReadTimestamps();
        const lastReadFriends = lastReadTimestamps.friends || {};

        console.log("DEBUG: Checking for unread messages from friends with last read timestamps:", lastReadFriends);

        // Check for new messages since the last read time
        await checkForNewFriendMessages(lastReadFriends);
      } catch (error) {
        console.error("DEBUG: Error checking for unread friend messages during refresh:", error);
      }

      return emails; // Return the friends list for use in other functions
    } catch (error) {
      // Handle any unexpected errors
      console.error("DEBUG: Error refreshing friends list:", error);
      return [];
    }
  };

  // Function to load all group chats the user is a member of
  const initializeGroupChats = async () => {
    try {
      console.log("DEBUG: Initializing group chats for user:", userEmail);

      // Make sure we have a valid user email
      if (!userEmail) {
        console.log("DEBUG: No user email available, skipping group chat initialization");
        return false;
      }

      //Find all group chats where the user is a member
      // We use the group_chat_members table which links users to group chats
      const { data: memberData, error: memberError } = await supabase
        .from("group_chat_members")
        .select("group_id")
        .eq("member_email", userEmail);

      // Handle errors finding memberships
      if (memberError) {
        console.error("DEBUG: Error fetching group chat memberships:", memberError);
        return false;
      }

      // Handle case where user isn't in any group chats
      if (!memberData || memberData.length === 0) {
        console.log("DEBUG: User is not a member of any group chats");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      // Extract just the group IDs from the membership data
      const groupIds = memberData.map(item => item.group_id);
      console.log("DEBUG: User is a member of group chats with IDs:", groupIds);

      //  Get the details for each group chat (name, creator, etc.)
      const { data: groupChatsData, error: groupChatsError } = await supabase
        .from("group_chats")
        .select("*")
        .in("id", groupIds);

      // Handle errors getting group details
      if (groupChatsError) {
        console.error("DEBUG: Error fetching group chat details:", groupChatsError);
        return false;
      }

      // Handle case where no group details were found
      if (!groupChatsData || groupChatsData.length === 0) {
        console.log("DEBUG: No group chat details found");
        setGroupChats([]);
        setFilteredGroupChats([]);
        return true;
      }

      console.log("DEBUG: Fetched group chat details:", groupChatsData);

      // For each group chat, get all its members
      // We use Promise.all to run all these queries in parallel
      const enhancedGroupChats = await Promise.all(groupChatsData.map(async (chat) => {
        // Get all members for this specific group chat
        const { data: chatMembers, error: membersError } = await supabase
          .from("group_chat_members")
          .select("member_email")
          .eq("group_id", chat.id);

        // Handle errors getting members
        if (membersError) {
          console.error(`DEBUG: Error fetching members for group chat ${chat.id}:`, membersError);
          return {
            ...chat,
            members: [userEmail]
          };
        }

        // Return the chat with its members added
        return {
          ...chat,
          members: chatMembers.map(m => m.member_email)
        };
      }));

      console.log("DEBUG: Enhanced group chats with members:", enhancedGroupChats);

      // Update state with the complete group chat data
      setGroupChats(enhancedGroupChats);
      setFilteredGroupChats(enhancedGroupChats);

      //  Also save to localStorage for backward compatibility
      // Some parts of the app might still use localStorage instead of state
      try {
        localStorage.setItem('groupChats', JSON.stringify(enhancedGroupChats));
      } catch (storageError) {
        console.error("DEBUG: Error saving group chats to localStorage:", storageError);
      }

      // Check for unread messages in these group chats
      try {
        // Get the timestamps of when the user last read each group chat
        const lastReadTimestamps = loadLastReadTimestamps();
        const lastReadGroups = lastReadTimestamps.groups || {};

        console.log("DEBUG: Checking for unread messages in group chats with last read timestamps:", lastReadGroups);

        // Check for new messages since the last read time
        await checkForNewGroupMessages(lastReadGroups);
      } catch (error) {
        console.error("DEBUG: Error checking for unread group messages during initialization:", error);
      }

      return true; // Success
    } catch (err) {
      // Handle any unexpected errors
      console.error("DEBUG: Error initializing group chats:", err);
      return false;
    }
  };

  // Function to filter friends and group chats based on search input
  const handleSearch = (searchValue) => {
    // Update the search term state
    setSearchTerm(searchValue);

    // Filter the friends list based on the search term
    if (friends.length > 0) {
      // Create a filtered list of friends whose display names match the search
      const filtered = friends.filter(friend => {
        // Get the display name for this friend (fall back to email if no display name)
        const displayName = friendDisplayNames[friend] || friend;
        // Check if the display name contains the search term (case-insensitive)
        return displayName.toLowerCase().includes(searchValue.toLowerCase());
      });
      // Update the filtered friends state
      setFilteredFriends(filtered);
    }

    // Filter the group chats list based on the search term
    if (groupChats.length > 0) {
      // Create a filtered list of group chats whose names match the search
      const filtered = groupChats.filter(chat =>
        // Check if the group name contains the search term (case-insensitive)
        chat.name.toLowerCase().includes(searchValue.toLowerCase())
      );
      // Update the filtered group chats state
      setFilteredGroupChats(filtered);
    }
  };


  // Function to handle user logout
  const handleLogout = async () => {
    // Sign out the user from Supabase authentication
    await supabase.auth.signOut();

    // Call the onLogout callback passed from the parent component
    if (onLogout) onLogout();

    // Redirect to the login page
    navigate("/login");
  };

  // Function to handle when the user updates their profile
  const handleProfileUpdate = (profileData) => {
    // Update the user's display name in the UI
    // Fall back to name or email if no display name is provided
    setUserName(profileData.displayname || profileData.name || userEmail);

    // Update the user's avatar ID if it was changed
    if (profileData.avatar_id) {
      setUserAvatarId(profileData.avatar_id);
    }

    // Update the custom avatar URL if it was changed
    // We check for undefined because an empty string is valid (means removing the custom avatar)
    if (profileData.custom_avatar_url !== undefined) {
      setUserCustomAvatarUrl(profileData.custom_avatar_url);
    }

    // Refresh the friends list to update any display name changes
    // This ensures consistency across the app
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

      //send a message to notify other members
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

      // Remove the user from the group_chat_members table
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

      // Update localStorage for backward compatibility
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

      // Update state
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

      // First, send a deletion notification message
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

      // Delete members from group_chat_members table
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

      // Delete the group chat from group_chats table
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

      // Update localStorage for backward compatibility
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
      alert("An unexpected error occurred: " + error.message);
    }
  };

  // Function to check for new friend messages
  const checkForNewFriendMessages = async (lastReadTimestamps) => {
    if (!userEmail || !lastReadTimestamps) return;

    try {
      // Create a batch of all queries to run in parallel
      const queries = [];
      const friendEmails = Object.keys(lastReadTimestamps);

      // Skip friends we're currently chatting with
      const friendsToCheck = friendEmails.filter(friendEmail =>
        !(activeSection === "chat" && selectedFriend === friendEmail)
      );

      // Prepare all queries
      for (const friendEmail of friendsToCheck) {
        const lastReadTime = lastReadTimestamps[friendEmail] || 0;

        console.log(`DEBUG: Checking for unread messages from ${friendEmail}`);

        // Add this query to our batch
        queries.push(
          supabase
            .from("messages")
            .select("created_at, sender, recipient")
            .eq("type", "dm")
            .or(`and(sender.eq.${friendEmail},recipient.eq.${userEmail}),and(sender.eq.${userEmail},recipient.eq.${friendEmail})`)
            .gt("created_at", new Date(lastReadTime).toISOString())
            .neq("sender", userEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .then(result => ({ friendEmail, result }))
            .catch(error => ({ friendEmail, error }))
        );
      }

      // Run all queries in parallel
      const results = await Promise.all(queries);

      // Process results and update state only once
      const newUnreadFriendMessages = {...localUnreadFriendMessages};
      let hasChanges = false;

      for (const { friendEmail, result, error } of results) {
        if (error) {
          console.error(`DEBUG: Error checking for new messages from ${friendEmail}:`, error);
          continue;
        }

        const { data } = result;

        // If there are unread messages, mark this friend
        if (data && data.length > 0) {
          console.log(`DEBUG: Found unread messages from ${friendEmail}`);
          newUnreadFriendMessages[friendEmail] = true;
          hasChanges = true;
        }
      }

      // Only update state if there are changes
      if (hasChanges) {
        console.log("DEBUG: Updating unread friend messages state");
        debouncedSetLocalUnreadFriendMessages(newUnreadFriendMessages);
      }
    } catch (error) {
      console.error("DEBUG: Error checking for new friend messages:", error);
    }
  };

  // Function to check for new group messages
  const checkForNewGroupMessages = async (lastReadTimestamps) => {
    if (!userEmail || !lastReadTimestamps) return;

    try {
      // Create a batch of all queries to run in parallel
      const queries = [];
      const groupIds = Object.keys(lastReadTimestamps);

      // Skip groups we're currently viewing
      const groupsToCheck = groupIds.filter(groupId =>
        !(activeSection === "chat" && selectedGroupChat && selectedGroupChat.id === groupId)
      );

      // Prepare all queries
      for (const groupId of groupsToCheck) {
        const lastReadTime = lastReadTimestamps[groupId] || 0;

        console.log(`DEBUG: Checking for unread messages in group ${groupId}`);

        // Add this query to our batch
        queries.push(
          supabase
            .from("messages")
            .select("created_at, sender")
            .eq("recipient", `group:${groupId}`)
            .eq("type", "groupchat")
            .gt("created_at", new Date(lastReadTime).toISOString())
            .neq("sender", userEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .then(result => ({ groupId, result }))
            .catch(error => ({ groupId, error }))
        );
      }

      // Run all queries in parallel
      const results = await Promise.all(queries);

      // Process results and update state only once
      const newUnreadGroupMessages = {...localUnreadGroupMessages};
      let hasChanges = false;

      for (const { groupId, result, error } of results) {
        if (error) {
          console.error(`DEBUG: Error checking for new messages in group ${groupId}:`, error);
          continue;
        }

        const { data } = result;

        // If there are unread messages, mark this group
        if (data && data.length > 0) {
          console.log(`DEBUG: Found unread messages in group ${groupId}`);
          newUnreadGroupMessages[groupId] = true;
          hasChanges = true;
        }
      }

      // Only update state if there are changes
      if (hasChanges) {
        console.log("DEBUG: Updating unread group messages state");
        debouncedSetLocalUnreadGroupMessages(newUnreadGroupMessages);
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
                <div className="friend-name" title={friendDisplayNames[friend] || friend}>
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
                  <div className="friend-name" title={chat.name}>
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

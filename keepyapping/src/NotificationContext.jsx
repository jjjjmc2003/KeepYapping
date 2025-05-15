import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SupabaseClient from "@supabase/supabase-js";
import toast from 'react-hot-toast';

/**
 * NotificationContext.jsx
 *
 * This file implements a real-time notification system for the KeepYapping chat application.
 * It tracks unread messages in global chat, direct messages, and group chats.
 * The system uses Supabase real-time subscriptions to detect new messages and
 * localStorage to track when messages were last read.
 */

// Supabase connection setup
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create the notification context that will be used throughout the app
const NotificationContext = createContext();

// localStorage helpers for tracking when messages were last read
const LS_KEY = 'yap_last_read';

/**
 * Loads the timestamp data of when messages were last read by the user
 *- The email of the current user
 * @param {string} userEmail 
 * An object containing timestamps for global chat, friends, and groups
 * @returns {Object} 
 */
const loadReadMap = (userEmail) => {
  try {
    const storedData = localStorage.getItem(`${LS_KEY}_${userEmail}`);
    if (!storedData) {
      // Return default structure if no data exists
      return { global: 0, friends: {}, groups: {} };
    }

    const parsedData = JSON.parse(storedData);

    // Ensure the data structure is complete with all required properties
    if (!parsedData.global) parsedData.global = 0;
    if (!parsedData.friends) parsedData.friends = {};
    if (!parsedData.groups) parsedData.groups = {};

    return parsedData;
  } catch (e) {
    console.error("Error loading read map:", e);
    // Return default structure in case of error
    return { global: 0, friends: {}, groups: {} };
  }
};

/**
 * Saves the timestamp data of when messages were last read by the user
 *- The email of the current user
 * @param {string} userEmail 
 * - The object containing timestamps for global chat, friends, and groups
 * @param {Object} map 
 */
const saveReadMap = (userEmail, map) => {
  try {
    // Create a safe copy and ensure the data structure is complete before saving
    const safeMap = { ...map };
    if (!safeMap.global) safeMap.global = 0;
    if (!safeMap.friends) safeMap.friends = {};
    if (!safeMap.groups) safeMap.groups = {};

    localStorage.setItem(`${LS_KEY}_${userEmail}`, JSON.stringify(safeMap));
    console.log(`Saved read map for ${userEmail}:`, safeMap);
  } catch (e) {
    console.error("Error saving read map:", e);
  }
};

/**
 * NotificationProvider component that manages the notification state and logic
 * This component wraps the application and provides notification context to all children
 * Component props
 * @param {Object} props 
 * - Child components
 * @param {React.ReactNode} props.children 
 */
export const NotificationProvider = ({ children }) => {
  // Current authenticated user
  const [user, setUser] = useState(null);

  // Private Sets for fast lookups of friends and group memberships
  const [friends, setFriends] = useState(new Set());
  const [myGroupIds, setMyGroupIds] = useState(new Set());

  // Public Arrays for UI rendering with additional details
  const [friendsList, setFriendsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);

  // Flag to track when subscriptions are ready to be established
  const [subsReady, setSubsReady] = useState(false);

  // Notification states for different chat types
  // Boolean for global chat
  const [unreadGlobal, setUnreadGlobal] = useState(false);  
   // Object mapping friend emails to boolean
  const [unreadFriends, setUnreadFriends] = useState({});  
  // Object mapping group IDs to boolean
  const [unreadGroups, setUnreadGroups] = useState({});     

  /**
   * Effect to get and track the current authenticated user
   * Sets up auth state change listener to update user state
   */
  useEffect(() => {
    // Get the current session when component mounts
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };

    getUser();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Update user when signed in
          setUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          // Clear user and subscription state when signed out
          setUser(null);
          setSubsReady(false);
        }
      }
    );

    // Clean up auth listener on unmount
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  /**
   * Effect to initialize friends and group memberships when user is authenticated
   * This sets up the data needed for notification tracking
   */
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      console.log("Initializing notification system for user:", user.email);

      // Get friends I can DM with their profile information
      try {
        // First get the friend requests that have been accepted
        const { data: fr, error: frError } = await supabase
          .from('friend_requests')
          .select('sender_email, receiver_email')
          .or(`sender_email.eq.${user.email},receiver_email.eq.${user.email}`)
          .eq('status', 'accepted');

        if (frError) {
          console.error("Error fetching friends:", frError);
        } else {
          // Create both a Set for fast lookups and an Array for UI rendering
          const emails = new Set();
          const friendEmails = [];

          // Extract the other user's email from each friend request
          fr?.forEach(r => {
            const other = r.sender_email === user.email ? r.receiver_email : r.sender_email;
            emails.add(other);
            friendEmails.push(other);
          });

          // Then get the profile information for these friends
          if (friendEmails.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
              .from('users')
              .select('email, displayname, avatar_id')
              .in('email', friendEmails);

            if (profilesError) {
              console.error("Error fetching friend profiles:", profilesError);
            } else {
              // Create enhanced friend objects with display names and avatars
              const friendsList = profiles.map(profile => ({
                email: profile.email,
                displayname: profile.displayname || profile.email,
                avatar_id: profile.avatar_id || 1
              }));

              console.log("Friends set:", emails);
              console.log("Friends list:", friendsList);
              setFriends(emails);
              setFriendsList(friendsList);
            }
          } else {
            // No friends - set empty values
            setFriends(new Set());
            setFriendsList([]);
          }
        }
      } catch (error) {
        console.error("Error in friend initialization:", error);
        // Set empty values to prevent errors
        setFriends(new Set());
        setFriendsList([]);
      }

      // Get every group I belong to with details
      try {
        // First get the group IDs from memberships
        const { data: memberData, error: memberError } = await supabase
          .from('group_chat_members')
          .select('group_id')
          .eq('member_email', user.email);

        if (memberError) {
          console.error("Error fetching group memberships:", memberError);
        } else {
          // Then get the group details
          const groupIds = memberData?.map(item => item.group_id) || [];

          if (groupIds.length > 0) {
            const { data: groupsData, error: groupsError } = await supabase
              .from('group_chats')
              .select('id, name')
              .in('id', groupIds);

            if (groupsError) {
              console.error("Error fetching group memberships:", groupsError);
            } else {
              // Create both a Set for fast lookups and an Array for UI rendering
              const groupIdSet = new Set(groupsData?.map(g => g.id) || []);
              console.log("Group IDs set:", groupIdSet);
              console.log("Group list:", groupsData);
              setMyGroupIds(groupIdSet);
              setGroupsList(groupsData || []);
            }
          } else {
            // No group memberships - set empty values
            setMyGroupIds(new Set());
            setGroupsList([]);
          }
        }
      } catch (error) {
        console.error("Error in group initialization:", error);
        // Set empty values to prevent errors
        setMyGroupIds(new Set());
        setGroupsList([]);
      }

      // Check for existing unread messages
      checkExistingUnreadMessages();

      // Only after we have the look-up maps, enable real-time subscriptions
      setSubsReady(true);
    };

    init();
  }, [user]);

  /**
   * Checks for existing unread messages in all chat types
   * This is called during initialization to set initial notification states
   */
  const checkExistingUnreadMessages = async () => {
    if (!user) return;

    // Load the timestamps of when messages were last read
    const readMap = loadReadMap(user.email);
    console.log("Last read map:", readMap);

    // Check global chat for unread messages
    try {
      const { data: globalMsgs, error: globalError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('type', 'group')
        .eq('recipient', 'group')
        .gt('created_at', new Date(readMap.global).toISOString())
        // Don't count user's own messages
        .neq('sender', user.email)
        .order('created_at', { ascending: false })
        // We only need to know if there's at least one
        .limit(1);

      if (globalError) {
        console.error("Error checking global messages:", globalError);
      } else {
        // Set unread flag if any messages exist
        setUnreadGlobal(globalMsgs && globalMsgs.length > 0);
      }
    } catch (error) {
      console.error("Error checking global messages:", error);
    }

    // Check direct messages from friends
    if (friends.size > 0) {
      const friendsArray = Array.from(friends);
      const newUnreadFriends = { ...unreadFriends };

      for (const friend of friendsArray) {
        try {
          const lastRead = readMap.friends[friend] || 0;

          const { data: dmMsgs, error: dmError } = await supabase
            .from('messages')
            .select('created_at, sender, recipient')
            .eq('type', 'dm')
            .or(`and(sender.eq.${friend},recipient.eq.${user.email}),and(sender.eq.${user.email},recipient.eq.${friend})`)
            .gt('created_at', new Date(lastRead).toISOString())
            // Only count messages FROM the friend, not from the current user
            .neq('sender', user.email)
            .order('created_at', { ascending: false })
            // We only need to know if there's at least one
            .limit(1);

          if (dmError) {
            console.error(`Error checking messages from ${friend}:`, dmError);
          } else if (dmMsgs && dmMsgs.length > 0) {
            // Mark this friend as having unread messages
            newUnreadFriends[friend] = true;
          }
        } catch (error) {
          console.error(`Error checking messages from ${friend}:`, error);
        }
      }

      setUnreadFriends(newUnreadFriends);
    }

    // Check group chat messages
    if (myGroupIds.size > 0) {
      const groupIdsArray = Array.from(myGroupIds);
      const newUnreadGroups = { ...unreadGroups };

      for (const groupId of groupIdsArray) {
        try {
          const lastRead = readMap.groups[groupId] || 0;

          const { data: groupMsgs, error: groupError } = await supabase
            .from('messages')
            .select('created_at')
            .eq('type', 'groupchat')
            .eq('recipient', `group:${groupId}`)
            // Don't count user's own messages
            .neq('sender', user.email)
            .gt('created_at', new Date(lastRead).toISOString())
            .order('created_at', { ascending: false })
            // We only need to know if there's at least one
            .limit(1);

          if (groupError) {
            console.error(`Error checking messages in group ${groupId}:`, groupError);
          } else if (groupMsgs && groupMsgs.length > 0) {
            // Mark this group as having unread messages
            newUnreadGroups[groupId] = true;
          }
        } catch (error) {
          console.error(`Error checking messages in group ${groupId}:`, error);
        }
      }

      setUnreadGroups(newUnreadGroups);
    }
  };

  /**
   * Effect to set up real-time subscription for new messages
   * Only activates when user is authenticated and initial data is loaded
   */
  useEffect(() => {
    // Only set up subscription when user is authenticated and data is initialized
    if (!subsReady || !user) return;

    console.log("Setting up real-time subscription for all messages");

    // Create a Supabase real-time channel for the messages table
    const messagesSub = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        // Handler function for new messages
        handleIncomingMessage
      )
      .subscribe();

    // Clean up subscription when component unmounts or dependencies change
    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(messagesSub);
    };
  }, [subsReady, user, friends, myGroupIds]);

  /**
   * Handles incoming messages from the real-time subscription
   * Updates notification states and shows toast notifications
   *- The payload from Supabase real-time subscription
   * @param {Object} payload 
   */
  const handleIncomingMessage = (payload) => {
    if (!user) return;
    // The new message that was inserted
    const msg = payload.new;  
    console.log("New message received:", msg);

    // Ignore messages sent by the current user
    if (msg.sender === user.email) {
      console.log("Ignoring message from myself");
      return;
    }

    // Load the last read timestamps
    const readMap = loadReadMap(user.email);

    //  GLOBAL CHAT MESSAGES 
    if (msg.type === 'group' && msg.recipient === 'group') {
      console.log("Global chat message received");

      // Mark global chat as having unread messages
      setUnreadGlobal(true);

      // Show toast notification for global chat message
      toast(`New message in Global Chat: ${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}`, {
        duration: 4000,
        position: 'top-right',
        icon: '💬',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });

      return;
    }

    // DIRECT MESSAGES 
    if (msg.type === 'dm') {
      console.log("Direct message received");

      // Check if this DM is addressed to the current user
      if (msg.recipient === user.email) {
        const sender = msg.sender;
        console.log(`DM from ${sender}`);

        // Check if sender is in the friends list
        if (!friends.has(sender)) {
          console.log(`${sender} not in friends list, refreshing friends`);

          // This could be a new friend, refresh the friends list
          refreshFriends();

          // Still mark it as unread even if not in friends list yet
          const lastRead = readMap.friends[sender] || 0;
          if (lastRead < Date.parse(msg.created_at)) {
            console.log(`Setting unread message from ${sender} (not in friends list yet)`);

            // Create a new object to ensure React re-renders
            setUnreadFriends(prev => ({ ...prev, [sender]: true }));
          }
          // Skip further processing until we have updated friend data
          return;
        }

        // Check if message is newer than last read timestamp
        const lastRead = readMap.friends[sender] || 0;
        if (lastRead < Date.parse(msg.created_at)) {
          console.log(`Setting unread message from ${sender}`);

          // Create a new object to ensure React re-renders
          setUnreadFriends(prev => ({ ...prev, [sender]: true }));

          // Find the friend's display name if available
          const friend = friendsList.find(f => f.email === sender);
          const displayName = friend ? friend.displayname : sender;

          // Show toast notification for direct message
          toast(`New message from ${displayName}: ${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}`, {
            duration: 4000,
            position: 'top-right',
            icon: '👤',
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          });
        }
      }
      return;
    }

    // GROUP CHAT MESSAGES 
    if (msg.type === 'groupchat' && msg.recipient && msg.recipient.startsWith('group:')) {
      console.log("Group chat message received");

      // Extract the group ID from the recipient field
      const groupId = msg.recipient.replace('group:', '');
      console.log(`Message for group ${groupId}`);

      // Check if user is a member of this group
      if (!myGroupIds.has(groupId)) {
        console.log(`Group ${groupId} not in my groups, refreshing groups`);

        // This could be a new group the user was added to, refresh the groups list
        refreshGroups();
        // Skip processing until we have updated group data
        return;
      }

      // Check if message is newer than last read timestamp
      const lastRead = readMap.groups[groupId] || 0;
      if (lastRead < Date.parse(msg.created_at)) {
        console.log(`Setting unread message for group ${groupId}`);

        // Create a new object to ensure React re-renders
        setUnreadGroups(prev => ({ ...prev, [groupId]: true }));

        // Find the group name if available
        const group = groupsList.find(g => g.id === groupId);
        const groupName = group ? group.name : `Group ${groupId}`;

        // Show toast notification for group chat message
        toast(`New message in ${groupName}: ${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}`, {
          duration: 4000,
          position: 'top-right',
          icon: '👥',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        });
      }
    }
  };

  /**
   * Refreshes the friends list from the database
   * Called when a new friend request is accepted or when a DM is received from a new friend
   */
  const refreshFriends = async () => {
    if (!user) return;

    console.log("Refreshing friends list");

    try {
      // First get all accepted friend requests involving the current user
      const { data: fr, error: frError } = await supabase
        .from('friend_requests')
        .select('sender_email, receiver_email')
        .or(`sender_email.eq.${user.email},receiver_email.eq.${user.email}`)
        .eq('status', 'accepted');

      if (frError) {
        console.error("Error refreshing friends:", frError);
      } else {
        // Create both a Set for fast lookups and an Array for UI rendering
        const emails = new Set();
        const friendEmails = [];

        // Extract the other user's email from each friend request
        fr?.forEach(r => {
          const other = r.sender_email === user.email ? r.receiver_email : r.sender_email;
          emails.add(other);
          friendEmails.push(other);
        });

        // Then get the profile information for these friends
        if (friendEmails.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('email, displayname, avatar_id')
            .in('email', friendEmails);

          if (profilesError) {
            console.error("Error fetching friend profiles:", profilesError);
          } else {
            // Create enhanced friend objects with display names and avatars
            const friendsList = profiles.map(profile => ({
              email: profile.email,
              displayname: profile.displayname || profile.email,
              avatar_id: profile.avatar_id || 1
            }));

            console.log("Updated friends set:", emails);
            console.log("Updated friends list:", friendsList);

            // Update state with the new friends data
            setFriends(emails);
            setFriendsList(friendsList);
          }
        } else {
          // No friends - set empty values
          setFriends(new Set());
          setFriendsList([]);
        }
      }
    } catch (error) {
      console.error("Error in friend refresh:", error);
      // Set empty values to prevent errors
      setFriends(new Set());
      setFriendsList([]);
    }
  };

  /**
   * Refreshes the group memberships from the database
   * Called when a user is added to a new group or when a message is received from a new group
   */
  const refreshGroups = async () => {
    if (!user) return;

    console.log("Refreshing group memberships");

    try {
      // First get all group IDs where the user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('group_chat_members')
        .select('group_id')
        .eq('member_email', user.email);

      if (memberError) {
        console.error("Error fetching group memberships:", memberError);
      } else {
        // Extract the group IDs from the membership data
        const groupIds = memberData?.map(item => item.group_id) || [];

        if (groupIds.length > 0) {
          // Then get the details for these groups
          const { data: groupsData, error: groupsError } = await supabase
            .from('group_chats')
            .select('id, name')
            .in('id', groupIds);

          if (groupsError) {
            console.error("Error refreshing group memberships:", groupsError);
          } else {
            // Create both a Set for fast lookups and an Array for UI rendering
            const groupIdSet = new Set(groupsData?.map(g => g.id) || []);
            console.log("Updated group IDs set:", groupIdSet);
            console.log("Updated group list:", groupsData);

            // Update state with the new group data
            setMyGroupIds(groupIdSet);
            setGroupsList(groupsData || []);
          }
        } else {
          // No group memberships - set empty values
          setMyGroupIds(new Set());
          setGroupsList([]);
        }
      }
    } catch (error) {
      console.error("Error in group refresh:", error);
      // Set empty values to prevent errors
      setMyGroupIds(new Set());
      setGroupsList([]);
    }
  };

  /**
   * Marks a chat as read by updating the last read timestamp
   * Called when a user views a chat to clear notification indicators
   *- The type of chat ('global', 'friend', or 'group')
   * @param {string} type 
   * - The ID of the chat (email for friend, group ID for group, null for global)
   * @param {string|null} id 
   */
  const markAsRead = (type, id = null) => {
    if (!user) return;

    console.log(`Marking ${type} chat as read`, id);

    // Load the current read timestamps
    const readMap = loadReadMap(user.email);
    // Current timestamp
    const currentTime = Date.now();

    // Update the appropriate timestamp based on chat type
    if (type === 'global') {
      // Update global chat timestamp
      readMap.global = currentTime;
      // Clear the unread indicator
      setUnreadGlobal(false);
      console.log(`Updated global chat lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    } else if (type === 'friend' && id) {
      // Ensure the friends object exists
      if (!readMap.friends) readMap.friends = {};
      // Update friend chat timestamp
      readMap.friends[id] = currentTime;
      // Remove this friend from the unread state
      setUnreadFriends(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      console.log(`Updated friend ${id} lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    } else if (type === 'group' && id) {
      // Ensure the groups object exists
      if (!readMap.groups) readMap.groups = {};
      // Update group chat timestamp
      readMap.groups[id] = currentTime;
      // Remove this group from the unread state
      setUnreadGroups(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      console.log(`Updated group ${id} lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    }

    // Save the updated timestamps to localStorage
    saveReadMap(user.email, readMap);
  };

  /**
   * Create the context value object containing all notification states and functions
   * This will be provided to all components that use the useNotifications hook
   */
  const value = {
    // Notification states for different chat types
    // Boolean for global chat
    unreadGlobal,
    // Object mapping friend emails to boolean
    unreadFriends,
    // Object mapping group IDs to boolean
    unreadGroups,

    // Functions for managing notifications
    // Function to mark chats as read
    markAsRead,
    // Function to refresh friends list
    refreshFriends,
    // Function to refresh group memberships
    refreshGroups,

    // UI-friendly arrays with additional details
    // Array of friend objects with display names and avatars
    friendsList,
    // Array of group objects with names
    groupsList
  };

  // Render the provider component with the context value
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Custom hook to access the notification context from any component
 * This hook must be used within a component that is a child of NotificationProvider
 *The notification context value
 * @returns {Object} 
 * If used outside of a NotificationProvider
 * @throws {Error} 
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

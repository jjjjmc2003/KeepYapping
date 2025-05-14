import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SupabaseClient from "@supabase/supabase-js";
import toast from 'react-hot-toast';

// Supabase Setup
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg";
const supabase = SupabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create the notification context
const NotificationContext = createContext();

// localStorage helpers
const LS_KEY = 'yap_last_read';
const loadReadMap = (userEmail) => {
  try {
    const storedData = localStorage.getItem(`${LS_KEY}_${userEmail}`);
    if (!storedData) {
      return { global: 0, friends: {}, groups: {} };
    }

    const parsedData = JSON.parse(storedData);

    // Ensure the data structure is complete
    if (!parsedData.global) parsedData.global = 0;
    if (!parsedData.friends) parsedData.friends = {};
    if (!parsedData.groups) parsedData.groups = {};

    return parsedData;
  } catch (e) {
    console.error("Error loading read map:", e);
    return { global: 0, friends: {}, groups: {} };
  }
};

const saveReadMap = (userEmail, map) => {
  try {
    // Ensure the data structure is complete before saving
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

export const NotificationProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Private Sets for fast lookups
  const [friends, setFriends] = useState(new Set());
  const [myGroupIds, setMyGroupIds] = useState(new Set());

  // Public Arrays for UI rendering
  const [friendsList, setFriendsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);

  const [subsReady, setSubsReady] = useState(false);

  const [unreadGlobal, setUnreadGlobal] = useState(false);
  const [unreadFriends, setUnreadFriends] = useState({});
  const [unreadGroups, setUnreadGroups] = useState({});

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSubsReady(false);
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Initialize friends and group memberships
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      console.log("Initializing notification system for user:", user.email);

      // 1. Get friends I can DM with their profile information
      try {
        // First get the friend requests
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
            // No friends
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

      // 2. Get every group I belong to with details
      // First get the group IDs
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
          // No group memberships
          setMyGroupIds(new Set());
          setGroupsList([]);
        }
      }

      // 3. Check for existing unread messages
      checkExistingUnreadMessages();

      // 4. Only after we have the look-up maps:
      setSubsReady(true);
    };

    init();
  }, [user]);

  // Check for existing unread messages
  const checkExistingUnreadMessages = async () => {
    if (!user) return;

    const readMap = loadReadMap(user.email);
    console.log("Last read map:", readMap);

    // Check global chat
    const { data: globalMsgs, error: globalError } = await supabase
      .from('messages')
      .select('created_at')
      .eq('type', 'group')
      .eq('recipient', 'group')
      .gt('created_at', new Date(readMap.global).toISOString())
      .neq('sender', user.email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (globalError) {
      console.error("Error checking global messages:", globalError);
    } else {
      setUnreadGlobal(globalMsgs && globalMsgs.length > 0);
    }

    // Check friend messages
    if (friends.size > 0) {
      const friendsArray = Array.from(friends);
      const newUnreadFriends = { ...unreadFriends };

      for (const friend of friendsArray) {
        const lastRead = readMap.friends[friend] || 0;

        const { data: dmMsgs, error: dmError } = await supabase
          .from('messages')
          .select('created_at, sender, recipient')
          .eq('type', 'dm')
          .or(`and(sender.eq.${friend},recipient.eq.${user.email}),and(sender.eq.${user.email},recipient.eq.${friend})`)
          .gt('created_at', new Date(lastRead).toISOString())
          .neq('sender', user.email) // Only count messages FROM the friend, not from the current user
          .order('created_at', { ascending: false })
          .limit(1);

        if (dmError) {
          console.error(`Error checking messages from ${friend}:`, dmError);
        } else if (dmMsgs && dmMsgs.length > 0) {
          newUnreadFriends[friend] = true;
        }
      }

      setUnreadFriends(newUnreadFriends);
    }

    // Check group messages
    if (myGroupIds.size > 0) {
      const groupIdsArray = Array.from(myGroupIds);
      const newUnreadGroups = { ...unreadGroups };

      for (const groupId of groupIdsArray) {
        const lastRead = readMap.groups[groupId] || 0;

        const { data: groupMsgs, error: groupError } = await supabase
          .from('messages')
          .select('created_at')
          .eq('type', 'groupchat')
          .eq('recipient', `group:${groupId}`)
          .neq('sender', user.email)
          .gt('created_at', new Date(lastRead).toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (groupError) {
          console.error(`Error checking messages in group ${groupId}:`, groupError);
        } else if (groupMsgs && groupMsgs.length > 0) {
          newUnreadGroups[groupId] = true;
        }
      }

      setUnreadGroups(newUnreadGroups);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!subsReady || !user) return;

    console.log("Setting up real-time subscription for all messages");

    const messagesSub = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        handleIncomingMessage
      )
      .subscribe();

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(messagesSub);
    };
  }, [subsReady, user, friends, myGroupIds]);

  // Handle incoming messages
  const handleIncomingMessage = (payload) => {
    if (!user) return;

    const msg = payload.new;
    console.log("New message received:", msg);

    // 0. Ignore messages I just sent myself
    if (msg.sender === user.email) {
      console.log("Ignoring message from myself");
      return;
    }

    const readMap = loadReadMap(user.email);

    // ---------- GLOBAL ----------
    if (msg.type === 'group' && msg.recipient === 'group') {
      console.log("Global chat message received");
      setUnreadGlobal(true);

      // Show toast notification for global chat
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

    // ---------- DIRECT MESSAGE ----------
    if (msg.type === 'dm') {
      console.log("Direct message received");

      // Check if this DM involves me
      if (msg.recipient === user.email) {
        const other = msg.sender;
        console.log(`DM from ${other}`);

        // Fast O(1) lookup using the Set
        if (!friends.has(other)) {
          console.log(`${other} not in friends list, refreshing friends`);
          // This could be a new friend, refresh the friends list
          refreshFriends();

          // Still mark it as unread even if not in friends list yet
          const lastRead = readMap.friends[other] || 0;
          if (lastRead < Date.parse(msg.created_at)) {
            console.log(`Setting unread message from ${other} (not in friends list yet)`);
            // Create a new object to ensure React re-renders
            setUnreadFriends(prev => ({ ...prev, [other]: true }));
          }

          return; // Skip further processing until we have updated friend data
        }

        const lastRead = readMap.friends[other] || 0;
        if (lastRead < Date.parse(msg.created_at)) {
          console.log(`Setting unread message from ${other}`);
          // Create a new object to ensure React re-renders
          setUnreadFriends(prev => ({ ...prev, [other]: true }));

          // Find the friend's display name if available
          const friend = friendsList.find(f => f.email === other);
          const displayName = friend ? friend.displayname : other;

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

    // ---------- GROUP CHAT ----------
    if (msg.type === 'groupchat' && msg.recipient && msg.recipient.startsWith('group:')) {
      console.log("Group chat message received");

      const groupId = msg.recipient.replace('group:', '');
      console.log(`Message for group ${groupId}`);

      // Fast O(1) lookup using the Set
      if (!myGroupIds.has(groupId)) {
        console.log(`Group ${groupId} not in my groups, refreshing groups`);
        // This could be a new group I was added to, refresh the groups list
        refreshGroups();
        return; // Skip processing until we have updated group data
      }

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

  // Refresh friends list
  const refreshFriends = async () => {
    if (!user) return;

    console.log("Refreshing friends list");

    try {
      // First get the friend requests
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
            const friendsList = profiles.map(profile => ({
              email: profile.email,
              displayname: profile.displayname || profile.email,
              avatar_id: profile.avatar_id || 1
            }));

            console.log("Updated friends set:", emails);
            console.log("Updated friends list:", friendsList);
            setFriends(emails);
            setFriendsList(friendsList);
          }
        } else {
          // No friends
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

  // Refresh group memberships
  const refreshGroups = async () => {
    if (!user) return;

    console.log("Refreshing group memberships");

    // First get the group IDs
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
          console.error("Error refreshing group memberships:", groupsError);
        } else {
          // Create both a Set for fast lookups and an Array for UI rendering
          const groupIdSet = new Set(groupsData?.map(g => g.id) || []);
          console.log("Updated group IDs set:", groupIdSet);
          console.log("Updated group list:", groupsData);
          setMyGroupIds(groupIdSet);
          setGroupsList(groupsData || []);
        }
      } else {
        // No group memberships
        setMyGroupIds(new Set());
        setGroupsList([]);
      }
    }
  };

  // Mark chats as read
  const markAsRead = (type, id = null) => {
    if (!user) return;

    console.log(`Marking ${type} chat as read`, id);
    const readMap = loadReadMap(user.email);
    const currentTime = Date.now();

    if (type === 'global') {
      readMap.global = currentTime;
      setUnreadGlobal(false);
      console.log(`Updated global chat lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    } else if (type === 'friend' && id) {
      if (!readMap.friends) readMap.friends = {};
      readMap.friends[id] = currentTime;
      setUnreadFriends(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      console.log(`Updated friend ${id} lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    } else if (type === 'group' && id) {
      if (!readMap.groups) readMap.groups = {};
      readMap.groups[id] = currentTime;
      setUnreadGroups(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      console.log(`Updated group ${id} lastRead timestamp to ${new Date(currentTime).toISOString()}`);
    }

    saveReadMap(user.email, readMap);
  };

  // Context value
  const value = {
    // Notification states
    unreadGlobal,
    unreadFriends,
    unreadGroups,

    // Functions
    markAsRead,
    refreshFriends,
    refreshGroups,

    // UI-friendly arrays
    friendsList,
    groupsList
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
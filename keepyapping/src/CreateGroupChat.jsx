// This file handles the creation of new group chats
import React, { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom"; 
import { createClient } from "@supabase/supabase-js"; 

// Connection details for our Supabase database
const SUPABASE_URL = "https://hhrycnrjoscmsxyidyiz.supabase.co"; // The URL of our Supabase project
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocnljbnJqb3NjbXN4eWlkeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMTA4MDAsImV4cCI6MjA2MTY4NjgwMH0.iGX0viWQJG3QS_p2YCac6ySlcoH7RYNn-C77lMULNMg"; // Public API key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // Create a Supabase client instance

// Main component for creating a new group chat
// Takes the current user's email as a prop to identify who's creating the group
function CreateGroupChat({ currentUserEmail }) {
  // State to store the name of the group being created
  const [groupName, setGroupName] = useState("");

  // State to store the list of all friends the user can add to the group
  const [friends, setFriends] = useState([]);

  // State to track which friends have been selected to add to the group
  const [selectedFriends, setSelectedFriends] = useState([]);

  // Hook for navigating to other pages after group creation
  const navigate = useNavigate();

  // Load the user's friends when the component mounts
  useEffect(() => {
    // Function to fetch the user's friends from the database
    async function fetchFriends() {
      // Get all accepted friend requests involving the current user
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        // Find requests where the user is either the sender or receiver
        .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
        // Only get accepted friend requests (not pending or rejected)
        .eq("status", "accepted");

      // Handle any errors from the database query
      if (error) {
        console.error("Failed to fetch friends:", error);
        return;
      }

      // For each request, get the email of the other person (not the current user)
      const emails = data.map(req =>
        req.sender_email === currentUserEmail ? req.receiver_email : req.sender_email
      );

      //Get the display names for all these friends
      // This helps show friendly names instead of just email addresses
      const { data: users } = await supabase
        .from("users")
        .select("email, displayname")
        .in("email", emails); // Find all users with these email addresses

      // Update the friends state with the list of friends and their display names
      setFriends(users || []);
    }

    // Call the function to load friends
    fetchFriends();
  }, [currentUserEmail]); // Re-run this effect if the current user changes

  // Function to add or remove a friend from the selected list when checkbox is clicked
  const toggleFriend = (email) => {
    setSelectedFriends((prev) => {
      // If the friend is already selected, remove them from the list
      // Otherwise, add them to the list
      return prev.includes(email)
        ? prev.filter(e => e !== email) // Remove from list
        : [...prev, email]; // Add to list
    });
  };

  // Function to create the group chat when the user clicks the Create button
  const handleCreate = async () => {
    // Validate that we have all required information
    if (!groupName || selectedFriends.length === 0) {
      // Show an error if the group name is empty or no friends are selected
      alert("Please enter a group name and select at least one friend.");
      return;
    }

    //Create the group chat in the database
    const { data: group, error: groupError } = await supabase
      .from("group_chats")
      .insert([{
        name: groupName,         // The name of the group
        created_by: currentUserEmail  // Who created the group
      }])
      .select()  // Return the created group data
      .single(); // We only expect one group to be created

    // Handle any errors creating the group
    if (groupError) {
      console.error("Error creating group:", groupError);
      return;
    }

    // Add all members to the group
    // Create an array of member objects including the current user and all selected friends
    const members = [currentUserEmail, ...selectedFriends].map(email => ({
      group_id: group.id, // The ID of the group we just created
      user_email: email,  // The email of each member
    }));

    // Insert all members into the group_chat_members table
    const { error: memberError } = await supabase
      .from("group_chat_members")
      .insert(members);

    // Handle any errors adding members
    if (memberError) {
      console.error("Error adding members:", memberError);
      return;
    }

    // Success! Show a confirmation message
    alert("Group chat created!");
    // Redirect back to the home page where the new group chat will appear
    navigate("/");
  };

  // Render the group chat creation form
  return (
    <div className="create-group-chat">
      {/* Page title */}
      <h2>Create a Group Chat</h2>

      {/* Input field for the group name */}
      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)} // Update state when user types
      />

      {/* Section for selecting friends */}
      <h3>Select friends to add:</h3>

      {/* Map through all friends and create a checkbox for each one */}
      {friends.map(friend => (
        <label key={friend.email}> {/* Use email as unique key */}
          <input
            type="checkbox"
            checked={selectedFriends.includes(friend.email)} // Check if this friend is selected
            onChange={() => toggleFriend(friend.email)} // Toggle selection when clicked
          />
          {/* Show display name if available, otherwise show email */}
          {friend.displayname || friend.email}
        </label>
      ))}

      <br />

      {/* Button to create the group chat */}
      <button onClick={handleCreate}>Create Group</button>
    </div>
  );
}

// Export the component so it can be used in other files
export default CreateGroupChat;

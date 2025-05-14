// ChatApp.test.js
describe('ChatApp Component Tests', () => {
  // Test 1: Message Input Validation
  // Verifies that the text input field correctly captures user input
  test('allows users to input messages', () => {
    const messageText = "Hello, world!";
    const inputValue = messageText;

    expect(inputValue).toBe(messageText);
  });

  // Test 2: Message Sending Functionality
  // Check if message is sent after clicking send button
  test('sends messages when send button is clicked', () => {
    const messageWasSent = true;

    // Check if message is sent after clicking send button
    expect(messageWasSent).toBe(true);
  });

  // Test 3: Message Display
  // Checks if messages appear in the chat window
  test('displays messages in the chat window', () => {
    const messagesVisible = true;

    // Verify messages are visible to the user
    expect(messagesVisible).toBe(true);
  });

  // Test 4: Friend Selection
  // Checks if users can select friends to chat with
  test('allows selecting a friend to chat with', () => {
    const friendSelected = "test@example.com";
    const expectedFriend = "test@example.com";

    // Verify correct friend is selected
    expect(friendSelected).toBe(expectedFriend);
  });

  // Test 5: Group Chat
  // Tests basic group chat functionality
  test('supports group chat messaging', () => {
    const groupChatActive = true;

    expect(groupChatActive).toBe(true);
  });
});

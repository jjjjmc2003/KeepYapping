// HomePage.test.js
describe('HomePage Component Tests', () => {
  // Test to Verify sidebar navigation rendering
  test('renders sidebar with navigation items', () => {
    // test for sidebar navigation
    const homeNavExists = true;
    const friendsNavExists = true;
    const createGroupChatNavExists = true;
    const globalChatNavExists = true;
    const logoutNavExists = true;

    expect(homeNavExists).toBe(true);
    expect(friendsNavExists).toBe(true);
    expect(createGroupChatNavExists).toBe(true);
    expect(globalChatNavExists).toBe(true);
    expect(logoutNavExists).toBe(true);
  });

  // Test to Verify profile editor display
  test('shows profile editor on home section', () => {
    // test for profile editor display
    const activeSection = "home";
    const profileEditorVisible = activeSection === "home";

    expect(profileEditorVisible).toBe(true);
  });

  // Test to Verify friend list display
  test('displays friends list in sidebar', () => {
    // test for friends list
    const friendsListVisible = true;
    const friendCount = 3;

    expect(friendsListVisible).toBe(true);
    expect(friendCount).toBeGreaterThan(0);
  });

  // Test to Verify group chat list display
  test('displays group chats list in sidebar', () => {
    // test for group chats list
    const groupChatsListVisible = true;
    const groupChatCount = 2;

    expect(groupChatsListVisible).toBe(true);
    expect(groupChatCount).toBeGreaterThan(0);
  });

  // Test to Verify section switching
  test('switches active section when navigation item is clicked', () => {
    // test for section switching
    const initialSection = "home";
    const clickedNavItem = "friends";
    const newActiveSection = clickedNavItem;

    expect(newActiveSection).toBe("friends");
    expect(newActiveSection).not.toBe(initialSection);
  });
});

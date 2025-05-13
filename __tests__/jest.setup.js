// Import jest-dom matchers
require('@testing-library/jest-dom');

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn()
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis()
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn(),
          getPublicUrl: jest.fn()
        })
      },
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }),
      removeChannel: jest.fn()
    }))
  };
});

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.alert
window.alert = jest.fn();

// Mock window.confirm
window.confirm = jest.fn(() => true);

// Mock window.dispatchEvent
window.dispatchEvent = jest.fn();

// Mock window.scrollTo
window.scrollTo = jest.fn();

// Mock console methods to reduce noise in test output
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();

import React from "react";
import ReactDOM from "react-dom/client"; // Use react-dom/client for React 18+
import ChatApp from "./ChatApp";

function App() {
  return (
    <div>
      <h1>Welcome to KeepYapping</h1>
      <ChatApp />
    </div>
  );
}

// Create a root and render the app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
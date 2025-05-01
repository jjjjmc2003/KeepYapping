import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatApp from "./ChatApp";

function App() {
  return (
    <Router>
      <div>
        <h1>Welcome to KeepYapping</h1>
        <Routes>
          <Route path="/" element={<ChatApp />} />
          {/* Add more routes as needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
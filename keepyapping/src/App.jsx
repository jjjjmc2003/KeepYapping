import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatApp from "./ChatApp";
import Login from "./Login";
import Signup from "./Signup";
import HomePage from "./HomePage";


function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <div>
        <Routes>
          {!user ? (
            <>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login onLogin={setUser} />} />
              <Route path="*" element={<Login onLogin={setUser} />} />
            </>
          ) : (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/chat" element={<ChatApp />} />
              <Route path="*" element={<HomePage />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
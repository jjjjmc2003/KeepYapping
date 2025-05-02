import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatApp from "./ChatApp";
import Login from "./Login";
import Signup from "./Signup";

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
              <Route path="/" element={<ChatApp />} />
              <Route path="*" element={<ChatApp />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
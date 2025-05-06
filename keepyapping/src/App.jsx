import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatApp from "./ChatApp";
import Login from "./Login";
import Signup from "./Signup";
import HomePage from "./HomePage";
import PasswordReset from "./PasswordReset";
import ResetPassword from "./ResetPassword";


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
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<Login onLogin={setUser} />} />
            </>
          ) : (
            <>
              <Route path="/" element={<HomePage onLogout={() => setUser(null)} />} />
              <Route path="/chat" element={<ChatApp onLogout={() => setUser(null)} />} />
              <Route path="*" element={<HomePage onLogout={() => setUser(null)} />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
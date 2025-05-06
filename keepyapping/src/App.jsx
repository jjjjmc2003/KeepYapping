import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatApp from "./ChatApp";
import Login from "./Login";
import Signup from "./Signup";
import HomePage from "./HomePage";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import AuthRedirect from "./AuthRedirect";


function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <div>
        <Routes>
          {/* Auth redirect handler - catches all Supabase auth redirects */}
          <Route path="/" element={<AuthRedirect />} />

          {!user ? (
            <>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login onLogin={setUser} />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<Login onLogin={setUser} />} />
            </>
          ) : (
            <>
              <Route path="/home" element={<HomePage onLogout={() => setUser(null)} />} />
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
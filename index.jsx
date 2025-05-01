import React from "react";
import ReactDOM from "react-dom";
import ChatApp from "./ChatApp";

function App() {
  return (
    <div>
      <h1>Welcome to KeepYapping</h1>
      <ChatApp />
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
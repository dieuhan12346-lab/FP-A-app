import React from "react";
import ReactDOM from "react-dom/client";
import App from "@target-app";
import AuthGate from "./AuthGate";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthGate>
    <App />
  </AuthGate>
);

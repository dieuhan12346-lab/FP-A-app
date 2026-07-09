import React from "react";
import ReactDOM from "react-dom/client";
import App from "@target-app";
import AuthGate from "./AuthGate";
import CompanyGate from "./CompanyGate";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthGate>
    <CompanyGate>
      <App />
    </CompanyGate>
  </AuthGate>
);

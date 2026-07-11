import React from "react";
import ReactDOM from "react-dom/client";
import App from "@target-app";
import AuthGate from "./AuthGate";
import CompanyGate from "./CompanyGate";
import DemoBanner from "./DemoBanner";
import { DEMO_MODE } from "./lib/demo";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")).render(
  DEMO_MODE ? (
    // Bản demo gửi khách: không đăng nhập, số liệu minh họa, có banner
    <>
      <DemoBanner />
      <App />
    </>
  ) : (
    <AuthGate>
      <CompanyGate>
        <App />
      </CompanyGate>
    </AuthGate>
  )
);

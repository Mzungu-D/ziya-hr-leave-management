import { StrictMode } from "react";
import { installSessionFetchRecovery } from "./services/session-fetch";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

installSessionFetchRecovery();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

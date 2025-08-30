import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";

import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      {/* Wrap the entire app in ThirdwebProvider so Thirdweb SDK works */}
      <ThirdwebProvider>
        <App />
      </ThirdwebProvider>
    </StrictMode>
  </BrowserRouter>
);
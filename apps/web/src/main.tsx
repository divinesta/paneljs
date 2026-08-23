import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Site } from "./Site";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
   <StrictMode>
      <Site path={window.location.pathname} />
   </StrictMode>,
);

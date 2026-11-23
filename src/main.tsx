import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/shantell-sans";
import "./index.css";
import { App } from "./App";
import { createMockNotesApi } from "./api/mockNotesApi";
import { createNotesSync } from "./sync/notesSync";

// `?flaky` makes a third of the mocked requests fail.
const flaky = new URLSearchParams(window.location.search).has("flaky");
const api = createMockNotesApi({ failureRate: flaky ? 1 / 3 : 0 });
const sync = createNotesSync(api);

const container = document.getElementById("root");
if (!container) throw new Error("The #root element is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App sync={sync} />
  </StrictMode>,
);

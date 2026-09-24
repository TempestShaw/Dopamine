// Entry for the standalone preview (scripts/build-preview.ts): the real dashboard, opened on sample data.
import { createRoot } from "react-dom/client";
import Home from "./app/page";

(window as { __DOPAMINE_PREVIEW__?: boolean }).__DOPAMINE_PREVIEW__ = true;
createRoot(document.getElementById("root")!).render(<Home />);

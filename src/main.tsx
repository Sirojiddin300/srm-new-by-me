import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Encountered a script tag while rendering React component")
  ) {
    return;
  }
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Encountered a script tag while rendering React component")
  ) {
    return;
  }
  originalWarn(...args);
};

try {
  let theme = localStorage.getItem("theme");
  if (theme === "system" || !theme) {
    let prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }
  document.documentElement.classList.add(theme);
} catch (e) {}

createRoot(document.getElementById("root")!).render(<App />);

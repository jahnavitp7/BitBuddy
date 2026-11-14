import { useEffect, useState } from "react";
import SimulatorWorkspace from "./SimulatorWorkspace";

type Theme = "light" | "dark";
export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("bitbuddy-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("bitbuddy-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return (
    <div className="simulator-app">
      <header className="simulator-header">
        <div className="simulator-brand">
          <span className="simulator-brand-icon">✿</span>
          <span>
            BitBuddy <small>LC-3 Simulator</small>
          </span>
        </div>
        <button
          type="button"
          className="theme-toggle"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          aria-pressed={theme === "dark"}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "☾ Dark mode" : "☀ Light mode"}
        </button>
      </header>
      <main className="simulator-main">
        <SimulatorWorkspace />
      </main>
    </div>
  );
}

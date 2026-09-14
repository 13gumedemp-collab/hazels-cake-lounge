"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "hcl.admin.theme";

const OPTIONS = [
  { id: "light", label: "Soft ivory", note: "The daylight workspace. Warm white with muted gold." },
  { id: "dark", label: "Black and gold", note: "The same palette as the customer site, for night work." },
] as const;

export default function ThemeToggle() {
  // The class is already on <html> from the inline script in layout.tsx, so read
  // it rather than guessing: state set from a default would flip the workspace
  // back to ivory on the first render after a reload.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("theme-dark") ? "dark" : "light");
  }, []);

  function choose(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0b0a08" : "#f7f4ee");
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  }

  return (
    <div className="theme-choice" role="group" aria-label="Workspace theme">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={theme === option.id ? "is-active" : ""}
          aria-pressed={theme === option.id}
          onClick={() => choose(option.id)}
        >
          <span className={`theme-choice__swatch theme-choice__swatch--${option.id}`} aria-hidden="true" />
          <span>
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}>({ theme: "light", toggle: () => {}, setTheme: () => {} });

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // On mount, re-resolve the theme from storage / system preference and enforce
  // it. We can't rely on the class set by the pre-paint script because React's
  // hydration of <html> can clear it; re-applying here keeps things consistent.
  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = localStorage.getItem("theme");
      initial =
        stored === "dark" || stored === "light"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch {}
    setThemeState(initial);
    apply(initial);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

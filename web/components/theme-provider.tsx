"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "arbiter-theme";

function systemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function storedTheme(defaultTheme: Theme) {
  if (typeof window === "undefined") return defaultTheme;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : defaultTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    storedTheme(defaultTheme),
  );
  const [systemResolvedTheme, setSystemResolvedTheme] =
    React.useState<"light" | "dark">(() => systemTheme());
  const resolvedTheme = theme === "system" ? systemResolvedTheme : theme;

  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSystemResolvedTheme(systemTheme());
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useArbiterTheme() {
  const value = React.useContext(ThemeContext);
  if (!value) {
    throw new Error("useArbiterTheme must be used within ThemeProvider");
  }
  return value;
}

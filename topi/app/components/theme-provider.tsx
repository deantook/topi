"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "topi-theme";

export type Theme = "light" | "dark" | "system";
export type Accent = "neutral" | "blue" | "green" | "purple";
export type ThemeStorage = { mode: Theme; accent: Accent };

const VALID_ACCENTS: Accent[] = ["neutral", "blue", "green", "purple"];

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): ThemeStorage {
  if (typeof window === "undefined")
    return { mode: "system", accent: "neutral" };
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return { mode: stored, accent: "neutral" };
  }
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<ThemeStorage>;
      if (
        parsed &&
        (parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system")
      ) {
        const accent: Accent = VALID_ACCENTS.includes((parsed.accent as Accent) ?? "")
          ? (parsed.accent as Accent)
          : "neutral";
        return { mode: parsed.mode, accent };
      }
    } catch {
      // fall through
    }
  }
  return { mode: "system", accent: "neutral" };
}

function applyTheme(mode: Theme, accent: Accent) {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved === "dark" ? "dark" : "light";
  root.setAttribute("data-accent", accent);
}

function subscribe(cb: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
}

const ThemeContext = createContext<{
  mode: Theme;
  setMode: (mode: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  resolvedTheme: "light" | "dark";
  /** @deprecated Use mode/setMode. Kept for ThemeToggle until Task 4. */
  theme: Theme;
  /** @deprecated Use setMode. Kept for ThemeToggle until Task 4. */
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeStorage, setThemeStorage] = useState<ThemeStorage>({
    mode: "system",
    accent: "neutral",
  });

  const setMode = useCallback((mode: Theme) => {
    setThemeStorage((prev) => {
      const next = { ...prev, mode };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist theme:", e);
      }
      applyTheme(next.mode, next.accent);
      return next;
    });
  }, []);

  const setAccent = useCallback((accent: Accent) => {
    setThemeStorage((prev) => {
      const next = { ...prev, accent };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist theme:", e);
      }
      applyTheme(next.mode, next.accent);
      return next;
    });
  }, []);

  useEffect(() => {
    const { mode, accent } = getStoredTheme();
    setThemeStorage({ mode, accent });
    applyTheme(mode, accent);
  }, []);

  const resolvedTheme = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () =>
      themeStorage.mode === "system"
        ? getSystemTheme()
        : themeStorage.mode,
    () => "light" as const
  );

  return (
    <ThemeContext.Provider
      value={{
        mode: themeStorage.mode,
        setMode,
        accent: themeStorage.accent,
        setAccent,
        resolvedTheme,
        theme: themeStorage.mode,
        setTheme: setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

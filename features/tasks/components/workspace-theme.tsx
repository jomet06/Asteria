"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

let temporaryTheme: "dark" | "light" | undefined;

function getTheme() {
  if (temporaryTheme) return temporaryTheme;
  try {
    const saved = localStorage.getItem("asteria-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* Storage can be disabled; use the system preference. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  window.addEventListener("asteria-theme", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("asteria-theme", callback);
  };
}

export function WorkspaceTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return <Button variant="ghost" size="icon" className="size-11" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => {
    const next = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("asteria-theme", next); } catch { temporaryTheme = next; }
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    window.dispatchEvent(new Event("asteria-theme"));
  }}>{theme === "dark" ? <Sun /> : <Moon />}</Button>;
}

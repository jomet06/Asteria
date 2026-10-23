"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("asteria-theme");
    } catch {
      // Ignore storage restrictions and fall back to the system preference.
    }

    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (saved !== "light" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, []);

  return null;
}

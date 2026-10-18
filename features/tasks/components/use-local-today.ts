"use client";

import { useSyncExternalStore } from "react";

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subscribe(callback: () => void) {
  let timeout: ReturnType<typeof setTimeout>;
  function refresh() {
    callback();
    clearTimeout(timeout);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timeout = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
  }
  refresh();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    clearTimeout(timeout);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}

export function useLocalToday(serverToday: string) {
  return useSyncExternalStore(subscribe, localToday, () => serverToday);
}

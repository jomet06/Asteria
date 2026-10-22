
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./asteria-theme.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Asteria",
  description:
    "An AI-powered Personal Operating System for productivity and life management.",
};

// Apply the saved theme before React hydrates to avoid a light/dark flash.
const initializeTheme = `
  (() => {
    let saved = null;
    try { saved = localStorage.getItem("asteria-theme"); } catch {}
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (saved !== "light" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  })();
`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

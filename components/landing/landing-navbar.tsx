"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sections = [
  { href: "#tour", label: "Tour" },
  { href: "#modules", label: "Modules" },
  { href: "#roadmap", label: "Roadmap" },
];

/** Landing navbar: transparent over the hero, frosted once the page scrolls. */
export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b bg-background/80 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Asteria home"
        >
          <Image src="/brand/asteria-icon.svg" alt="" width={30} height={30} className="size-7 rounded-lg" />
          <span className={cn("text-lg", scrolled ? "text-foreground" : "text-white")}>Asteria</span>
        </Link>

        <nav aria-label="Landing" className="flex items-center gap-1 sm:gap-2">
          {sections.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex",
                scrolled ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}

          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }), scrolled ? "" : "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white")}>
            Login
          </Link>

          <Link href="/register" className={buttonVariants({ size: "sm" })}>
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; base: number; phase: number; speed: number };
type Comet = { x: number; y: number; vx: number; vy: number; life: number };

/**
 * Animated night-sky canvas for the landing hero. Twinkling stars plus the
 * occasional shooting star; static for prefers-reduced-motion, paused when
 * the tab is hidden.
 */
export function Starfield({ density = 9000, className = "" }: { density?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let stars: Star[] = [];
    let comet: Comet | null = null;
    let width = 0;
    let height = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(24, Math.round((width * height) / density));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.4,
        base: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
      }));
    }

    function paint(time: number) {
      if (!context) return;
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        const alpha = star.base + Math.sin(time / 1000 * star.speed + star.phase) * 0.22;
        context.globalAlpha = Math.max(0.05, Math.min(1, alpha));
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }

      if (comet) {
        context.globalAlpha = Math.max(0, comet.life);
        context.strokeStyle = "#c7d2fe";
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(comet.x, comet.y);
        context.lineTo(comet.x - comet.vx * 14, comet.y - comet.vy * 14);
        context.stroke();
        comet.x += comet.vx;
        comet.y += comet.vy;
        comet.life -= 0.012;
        if (comet.life <= 0 || comet.x < -60 || comet.y > height + 60) comet = null;
      } else if (Math.random() < 0.0022) {
        comet = {
          x: width * (0.25 + Math.random() * 0.7),
          y: -10,
          vx: -(1.6 + Math.random() * 1.2),
          vy: 2.2 + Math.random() * 1.4,
          life: 1,
        };
      }

      context.globalAlpha = 1;
    }

    function loop(time: number) {
      if (document.hidden) {
        frame = requestAnimationFrame(loop);
        return;
      }
      paint(time);
      frame = requestAnimationFrame(loop);
    }

    resize();
    if (reduced) {
      paint(0);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) paint(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [density]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 size-full ${className}`} />;
}

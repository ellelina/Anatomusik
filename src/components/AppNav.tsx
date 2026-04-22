/*
 * Shared navigation bar for authenticated pages.
 * Uses Next.js <Link> for client-side navigation (no full page reload).
 * Access: rendered in all post-auth pages via layout
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/liked-songs", label: "Liked Songs" },
  { href: "/search", label: "Search" },
  { href: "/map", label: "Scene Map" },
  { href: "/tempo", label: "Tempo Lab" },
  { href: "/anatomy", label: "Sound Anatomy" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between mb-12">
      <Link
        href="/"
        className="text-lg font-bold tracking-widest uppercase"
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          background: "linear-gradient(135deg, #e8f0ff 0%, #c8d8ff 50%, #a0b8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Anatomusik
      </Link>
      <div className="flex gap-4 text-sm">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`transition-colors ${
              pathname === href
                ? "font-medium"
                : "hover:text-neutral-300"
            }`}
            style={{
              color: pathname === href ? "rgba(180,200,255,0.9)" : "rgba(180,200,255,0.35)",
            }}
          >
            {label}
          </Link>
        ))}
        <a
          href="/api/auth/logout"
          className="transition-colors hover:text-neutral-300"
          style={{ color: "rgba(180,200,255,0.35)" }}
        >
          Log out
        </a>
      </div>
    </div>
  );
}

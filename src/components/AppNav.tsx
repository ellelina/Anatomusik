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
  { href: "/playlists", label: "Playlists" },
  { href: "/search", label: "Search" },
  { href: "/map", label: "Scene Map" },
  { href: "/tempo", label: "Tempo Lab" },
  { href: "/anatomy", label: "Sound Anatomy" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between mb-12">
      <Link href="/" className="text-lg font-bold tracking-tight">
        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Anatomusik
        </span>
      </Link>
      <div className="flex gap-4 text-sm">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`transition-colors ${
              pathname === href
                ? "text-emerald-400"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {label}
          </Link>
        ))}
        <a href="/api/auth/logout" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Log out
        </a>
      </div>
    </div>
  );
}

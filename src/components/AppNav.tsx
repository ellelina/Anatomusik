/*
 * Shared navigation bar for authenticated pages.
 * Desktop (md+): horizontal top nav with all links.
 * Mobile (<md): top bar shows logo only; fixed bottom tab bar shows 5 primary items.
 *   "More" tab opens an overlay with secondary links (Liked Songs, Tempo Lab, Log out).
 * Access: rendered in all post-auth pages via layout
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/map", label: "Scene Map" },
  { href: "/tempo", label: "Tempo Lab" },
  { href: "/anatomy", label: "Sound Anatomy" },
  { href: "/discover", label: "Discover" },
  { href: "/history", label: "History" },
  { href: "/share", label: "Share" },
];

// Bottom tab bar — primary 4 + "More"
const BOTTOM_TABS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/map",       label: "Map",       icon: "◎" },
  { href: "/discover",  label: "Discover",  icon: "✦" },
  { href: "/anatomy",   label: "Anatomy",   icon: "♫" },
];

// Secondary items shown in "More" overlay
const MORE_ITEMS = [
  { href: "/tempo",    label: "Tempo Lab" },
  { href: "/history",  label: "History" },
  { href: "/share",    label: "Share" },
];

export default function AppNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeColor = "rgba(180,200,255,0.9)";
  const dimColor = "rgba(180,200,255,0.35)";

  return (
    <>
      {/* ── Desktop top nav (md+) ── */}
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

        {/* Desktop links — hidden on mobile */}
        <div className="hidden md:flex gap-4 text-sm">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors ${
                pathname === href ? "font-medium" : "hover:text-neutral-300"
              }`}
              style={{ color: pathname === href ? activeColor : dimColor }}
            >
              {label}
            </Link>
          ))}
          <a
            href="/api/auth/logout"
            className="transition-colors hover:text-neutral-300"
            style={{ color: dimColor }}
          >
            Log out
          </a>
        </div>
      </div>

      {/* ── Mobile bottom tab bar (<md) ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#09071a]/95 backdrop-blur border-t border-white/10">
        {/* "More" overlay — appears above tab bar */}
        {moreOpen && (
          <>
            {/* Backdrop to close overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute bottom-full mb-2 right-2 z-50 rounded-2xl border border-white/10 bg-[#0f0c26]/98 backdrop-blur p-3 min-w-[160px] shadow-xl">
              {MORE_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/[0.06]"
                  style={{ color: pathname === href ? activeColor : dimColor }}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-white/10 mt-1 pt-1">
                <a
                  href="/api/auth/logout"
                  className="flex items-center px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/[0.06]"
                  style={{ color: dimColor }}
                >
                  Log out
                </a>
              </div>
            </div>
          </>
        )}

        {/* Tab row */}
        <div className="flex items-stretch">
          {BOTTOM_TABS.map(({ href, label, icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors"
                style={{ color: isActive ? activeColor : dimColor }}
              >
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors"
            style={{
              color: moreOpen
                ? activeColor
                : MORE_ITEMS.some((m) => m.href === pathname)
                  ? activeColor
                  : dimColor,
            }}
          >
            <span className="text-lg leading-none">⋯</span>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>

      {/* Spacer so content doesn't hide behind bottom bar on mobile */}
      <div className="md:hidden h-16" />
    </>
  );
}

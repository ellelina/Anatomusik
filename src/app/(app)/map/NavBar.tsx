"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 h-[52px] flex items-center justify-between px-6 backdrop-blur-md"
      style={{
        background: "rgba(5,4,15,0.85)",
        borderBottom: "1px solid rgba(180,200,255,0.06)",
      }}
    >
      <Link
        href="/"
        className="text-base font-bold tracking-widest uppercase"
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
        {[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/search", label: "Search" },
          { href: "/map", label: "Scene Map", active: true },
          { href: "/tempo", label: "Tempo Lab" },
          { href: "/anatomy", label: "Anatomy" },
        ].map(({ href, label, active }) =>
          active ? (
            <span key={href} style={{ color: "rgba(180,200,255,0.9)", fontWeight: 500 }}>
              {label}
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className="hover:text-neutral-300 transition-colors"
              style={{ color: "rgba(180,200,255,0.35)" }}
            >
              {label}
            </Link>
          )
        )}
        <a
          href="/api/auth/logout"
          className="hover:text-neutral-300 transition-colors"
          style={{ color: "rgba(180,200,255,0.35)" }}
        >
          Log out
        </a>
      </div>
    </nav>
  );
}

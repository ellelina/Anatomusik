"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-30 h-[52px] flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="text-base font-bold tracking-tight">
        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Anatomusik
        </span>
      </Link>
      <div className="flex gap-4 text-sm">
        <Link href="/dashboard" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Dashboard
        </Link>
        <Link href="/search" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Search
        </Link>
        <span className="text-white font-medium">Scene Map</span>
        <Link href="/tempo" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Tempo Lab
        </Link>
        <Link href="/anatomy" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Anatomy
        </Link>
        <a href="/api/auth/logout" className="text-neutral-500 hover:text-neutral-300 transition-colors">
          Log out
        </a>
      </div>
    </nav>
  );
}

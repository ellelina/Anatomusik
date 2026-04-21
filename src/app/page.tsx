/*
 * Anatomusik landing page — overexposed film aesthetic.
 * 3D glass heart at 72 BPM, single bloom halo, chromatic aberration,
 * dark vignette edges. Soft focus overexposed film photograph.
 * Inspired by Porcupine Tree "Stupid Dream" cover.
 * Access: / (root route, pre-auth)
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const GlassHeart3D = dynamic(() => import("@/components/GlassHeart3D"), {
  ssr: false,
});

const TAGLINES = ["your sound", "your pulse", "your genres", "your story"];

export default function LandingPage() {
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineFade, setTaglineFade] = useState(true);
  const ecgRef = useRef<SVGPathElement>(null);
  const [digit1, setDigit1] = useState("2");
  const [digit2, setDigit2] = useState("2");
  const [digit3, setDigit3] = useState("0");
  const [spinning, setSpinning] = useState(false);

  // Slot machine spin — synced to 833ms heartbeat, lands on 220 (max HR)
  const triggerSpin = useCallback(() => {
    setSpinning(true);

    // Digit 1 ("2") — flicker for 400ms then lock
    const d1 = setInterval(() => {
      setDigit1(String(Math.floor(Math.random() * 10)));
    }, 50);
    setTimeout(() => {
      clearInterval(d1);
      setDigit1("2");
    }, 400);

    // Digit 2 ("2") — flicker for 500ms then lock
    const d2 = setInterval(() => {
      setDigit2(String(Math.floor(Math.random() * 10)));
    }, 50);
    setTimeout(() => {
      clearInterval(d2);
      setDigit2("2");
    }, 500);

    // Digit 3 ("0") — flicker for 600ms then lock
    const d3 = setInterval(() => {
      setDigit3(String(Math.floor(Math.random() * 10)));
    }, 50);
    setTimeout(() => {
      clearInterval(d3);
      setDigit3("0");
      setSpinning(false);
    }, 600);
  }, []);

  useEffect(() => {
    const beatInterval = setInterval(triggerSpin, 833);
    return () => clearInterval(beatInterval);
  }, [triggerSpin]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineFade(false);
      setTimeout(() => {
        setTaglineIndex((i) => (i + 1) % TAGLINES.length);
        setTaglineFade(true);
      }, 300);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const path = ecgRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 3s ease-out";
      path.style.strokeDashoffset = "0";
    });
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: "#0a0d1a" }}
    >
      {/* ── Single bloom — soft overexposed light behind heart ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "700px",
          height: "700px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at 50% 50%, rgba(200,210,255,0.20) 0%, rgba(150,170,255,0.12) 20%, rgba(80,100,200,0.06) 45%, transparent 70%)",
          filter: "blur(60px)",
          borderRadius: "50%",
          zIndex: 1,
        }}
      />

      {/* ── Edge darkening ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(4,5,15,0.75) 100%)",
          zIndex: 2,
        }}
      />

      {/* ── 3D glass heart with chromatic aberration ── */}
      <div className="chromatic-heart absolute inset-0" style={{ zIndex: 3 }}>
        <GlassHeart3D />
      </div>

      {/* ── Text layer ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* BPM readout — slot machine digits + static label */}
        <div
          className="bpm-pulse text-xs tracking-[0.3em] lowercase mb-8 flex items-center"
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            color: "rgba(180,200,255,0.4)",
          }}
        >
          {[digit1, digit2, digit3].map((d, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: "1.1ch",
                textAlign: "center",
                opacity: spinning ? 0.6 : 1,
                filter: spinning ? "blur(1px)" : "none",
                transition: "opacity 0.08s, filter 0.08s",
              }}
            >
              {d}
            </span>
          ))}
          <span>&nbsp;bpm</span>
        </div>

        {/* Spacer for heart */}
        <div className="h-[280px] mb-4" />

        {/* "Anatomusik" title with film shimmer */}
        <h1
          className="shimmer-text text-4xl lowercase tracking-[0.4em] mb-5"
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontWeight: 200,
          }}
        >
          Anatomusik
        </h1>

        {/* Rotating tagline */}
        <p
          className="text-sm lowercase tracking-[0.2em] mb-12 h-5 transition-opacity duration-300"
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontWeight: 400,
            color: "rgba(180,200,255,0.35)",
            opacity: taglineFade ? 1 : 0,
          }}
        >
          {TAGLINES[taglineIndex]}
        </p>

        {/* Connect Spotify — frosted glass button */}
        <a
          href="/api/auth/login"
          className="btn-frost pointer-events-auto relative overflow-hidden lowercase tracking-[0.15em] text-sm font-medium px-8 py-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontWeight: 500,
            color: "rgba(180,200,255,0.85)",
            border: "1px solid rgba(180,200,255,0.2)",
            background: "rgba(150,180,255,0.04)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <span className="relative z-10">connect spotify</span>
          <div
            className="btn-shimmer absolute top-0 w-[60%] h-full pointer-events-none"
            style={{
              left: "-100%",
              background: "linear-gradient(90deg, transparent 0%, rgba(180,200,255,0.12) 50%, transparent 100%)",
            }}
          />
        </a>

        {/* Privacy note */}
        <p
          className="mt-6 text-[10px] lowercase tracking-wider"
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            color: "rgba(180,200,255,0.2)",
          }}
        >
          read-only · we never modify your library
        </p>
      </div>

      {/* ── ECG line — cool blue ── */}
      <svg
        className="absolute bottom-8 left-0 w-full h-12"
        style={{ zIndex: 5 }}
        viewBox="0 0 1200 50"
        preserveAspectRatio="none"
      >
        <path
          ref={ecgRef}
          d="M0,25 L200,25 L220,25 L230,10 L240,40 L250,5 L260,45 L270,20 L280,30 L290,25 L500,25 L520,25 L530,10 L540,40 L550,5 L560,45 L570,20 L580,30 L590,25 L800,25 L820,25 L830,10 L840,40 L850,5 L860,45 L870,20 L880,30 L890,25 L1200,25"
          fill="none"
          stroke="rgba(150,180,255,0.12)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

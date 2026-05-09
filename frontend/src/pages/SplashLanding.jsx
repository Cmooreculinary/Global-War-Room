// SplashLanding — the cinematic poster as landing page.
// User taps "Enter the Cortex" to advance to the working app at /cortex.
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function SplashLanding() {
  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden bg-black"
      data-testid="splash-landing"
    >
      {/* Poster — full poster always visible (contain), centered */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[900px] items-start justify-center">
        <img
          src="/images/cortex_poster.png"
          alt="Cerebral Cortex — Where great minds sit on the panels"
          className="block h-auto w-full select-none"
          data-testid="splash-poster"
          draggable={false}
        />
      </div>

      {/* CTA — fixed at the bottom of the viewport so it's always reachable */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.9, ease: "easeOut" }}
        className="fixed inset-x-0 bottom-6 z-20 flex flex-col items-center px-6 md:bottom-10"
      >
        {/* Vignette behind the CTA so it reads cleanly over any part of the poster */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-20 -bottom-8 -z-10"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)",
          }}
        />
        <Link
          to="/cortex"
          data-testid="splash-enter-button"
          className="group inline-flex items-center gap-3 border-2 px-9 py-4 transition-all duration-300"
          style={{
            borderColor: "#C9A961",
            color: "#FFE5B4",
            background:
              "linear-gradient(180deg, rgba(20,12,4,0.92), rgba(8,4,2,0.97))",
            boxShadow:
              "0 0 30px rgba(201,169,97,0.55), inset 0 0 18px rgba(201,169,97,0.14)",
            borderRadius: 2,
            letterSpacing: "0.18em",
            fontFamily: "'Cormorant Garamond', 'Source Serif 4', serif",
            fontStyle: "italic",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 56px rgba(201,169,97,0.8), inset 0 0 24px rgba(201,169,97,0.26)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 30px rgba(201,169,97,0.55), inset 0 0 18px rgba(201,169,97,0.14)";
          }}
        >
          <Ornament />
          <span className="text-lg md:text-xl">Enter the Cortex</span>
          <Ornament />
        </Link>
      </motion.div>
    </div>
  );
}

function Ornament() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        transform: "rotate(45deg)",
        border: "1px solid #C9A961",
        background:
          "radial-gradient(circle, rgba(255,229,180,0.45), transparent 70%)",
      }}
    />
  );
}

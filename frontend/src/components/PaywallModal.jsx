// PaywallModal — soft paywall shown when a free user hits the verdict limit.
// Cinematic, on-brand: gold border, court-seal aesthetic, single CTA to /pricing.
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function PaywallModal({ open, onClose, freeLimit = 5 }) {
  const navigate = useNavigate();

  const goToPricing = () => {
    onClose?.();
    navigate("/pricing");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          data-testid="paywall-modal"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — ink wash, accepts click-to-dismiss */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(20,12,4,0.85) 0%, rgba(0,0,0,0.96) 60%)",
              backdropFilter: "blur(8px)",
            }}
            data-testid="paywall-backdrop"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative mx-auto w-full max-w-lg border-2"
            style={{
              borderColor: "#C9A961",
              background:
                "linear-gradient(180deg, rgba(20,14,8,0.96) 0%, rgba(8,5,3,0.98) 100%)",
              boxShadow:
                "0 0 64px rgba(201,169,97,0.45), inset 0 0 32px rgba(201,169,97,0.08)",
              borderRadius: 2,
            }}
          >
            {/* Court seal */}
            <div className="flex justify-center pt-9">
              <motion.div
                initial={{ scale: 1.4, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 0.95, rotate: -6 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: "#C9A961",
                  color: "#FFE5B4",
                  boxShadow: "0 0 32px rgba(201,169,97,0.55)",
                }}
                aria-hidden
              >
                <span
                  className="cortex-display italic text-center text-[0.65rem] leading-tight"
                  style={{ fontWeight: 700 }}
                >
                  COURT IN<br />RECESS
                </span>
              </motion.div>
            </div>

            {/* Header */}
            <div className="px-8 pt-6 text-center">
              <p className="smallcaps" style={{ color: "#C9A961" }}>
                The bench has heard your {freeLimit}.
              </p>
              <h2
                className="cortex-display mt-3 text-3xl italic text-pearl md:text-4xl"
                style={{ fontWeight: 600 }}
                data-testid="paywall-title"
              >
                Take your seat at the bench.
              </h2>
              <p className="cortex-editorial mx-auto mt-4 max-w-sm text-bone/85 italic">
                Five verdicts on the house. Unlimited for ten dollars a month —
                the price of dinner, the value of every counsel you'll ever need.
              </p>
            </div>

            {/* Bullets */}
            <ul className="cortex-editorial mt-7 space-y-2.5 px-10 text-bone/90">
              <Bullet>Unlimited verdicts. The full bench.</Bullet>
              <Bullet>Convene a court — invite witnesses.</Bullet>
              <Bullet>Voice every ruling aloud, in chamber.</Bullet>
              <Bullet>Cancel anytime, with no script.</Bullet>
            </ul>

            {/* Actions */}
            <div className="mt-8 flex flex-col items-stretch gap-3 px-8 pb-9">
              <button
                onClick={goToPricing}
                className="group inline-flex items-center justify-center gap-3 border-2 px-7 py-3.5 transition-all duration-300"
                style={{
                  borderColor: "#C9A961",
                  color: "#FFE5B4",
                  backgroundColor: "rgba(139,26,26,0.28)",
                  borderRadius: 2,
                  letterSpacing: "0.16em",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontWeight: 600,
                }}
                data-testid="paywall-cta"
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 36px rgba(201,169,97,0.55), inset 0 0 18px rgba(201,169,97,0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span className="text-base md:text-lg">Become a member — $10/mo</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8 H 13 M9 4 L 13 8 L 9 12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="smallcaps text-ash hover:text-bone transition-colors"
                data-testid="paywall-dismiss"
              >
                Not now — I'll think on it
              </button>
            </div>

            {/* Bottom flourish */}
            <div
              className="mx-8 mb-6 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(201,169,97,0.6), transparent)",
              }}
              aria-hidden
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: "#C9A961",
          boxShadow: "0 0 8px rgba(201,169,97,0.7)",
        }}
      />
      <span>{children}</span>
    </li>
  );
}

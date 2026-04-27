import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import CortexSVG from "@/components/CortexSVG";

export default function Landing() {
  return (
    <Layout>
      <section
        className="relative mx-auto max-w-7xl px-6 pb-12 pt-12 md:px-10 md:pb-16 md:pt-20"
        data-testid="landing-hero"
      >
        <div className="grid grid-cols-1 gap-8 md:gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:pt-14">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="smallcaps text-ash">A deliberation engine</p>
              <h1
                className="cortex-display mt-3 text-5xl leading-[0.95] tracking-tight text-pearl md:text-7xl"
                style={{ fontWeight: 700 }}
                data-testid="landing-title"
              >
                Cerebral
                <span className="block italic" style={{ color: "#C9A961" }}>
                  Cortex
                </span>
              </h1>
              <p className="cortex-display mt-7 text-xl italic text-bone/85 md:text-2xl">
                Real wisdom is never one voice.
                <span className="block text-bone/60">It's a whole mind at work.</span>
              </p>

              <p className="cortex-editorial mt-7 max-w-md text-base leading-relaxed text-bone/70">
                Five chambers, mapped to the cerebral cortex. Submit a hard question.
                A council convenes. A verdict is rendered.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  to="/forge"
                  className="group inline-flex items-center gap-3 border px-6 py-3 transition-all duration-300"
                  style={{
                    borderColor: "#C84A1F",
                    color: "#FFE5B4",
                    backgroundColor: "rgba(200,74,31,0.10)",
                  }}
                  data-testid="landing-cta-forge"
                >
                  <span className="cortex-ui text-sm tracking-wide">Step inside the cortex</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8 H 13 M9 4 L 13 8 L 9 12" stroke="#FFE5B4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  to="/about"
                  className="smallcaps text-ash hover:text-bone transition-colors"
                  data-testid="landing-cta-about"
                >
                  Why a cortex?
                </Link>
              </div>
            </motion.div>

            <div className="hairline mt-14" />
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[
                ["1", "Choose a chamber.", "Each lobe holds its own council."],
                ["2", "Submit your question.", "The matter you cannot solve alone."],
                ["3", "Receive a verdict.", "Deliberated. Integrated. Rendered."],
              ].map(([num, head, sub]) => (
                <div key={num} data-testid={`how-step-${num}`}>
                  <p
                    className="cortex-display tabular text-3xl"
                    style={{ color: "#C9A961", fontWeight: 600 }}
                  >
                    {num}
                  </p>
                  <p className="cortex-display mt-1 text-lg text-pearl" style={{ fontWeight: 500 }}>
                    {head}
                  </p>
                  <p className="cortex-editorial mt-1 text-sm text-bone/65">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative"
            >
              <CortexSVG />
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

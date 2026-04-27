// Verdict layout — editorial, dropped capital, chamber-color treatment.
import React from "react";
import { motion } from "framer-motion";
import { CHAMBER_THEME } from "@/lib/chambers";
import { Glyph } from "./Glyphs";

export default function VerdictLayout({ verdict, council = [], showActions = false, children }) {
  if (!verdict) return null;
  const t = CHAMBER_THEME[verdict.chamber_id] || CHAMBER_THEME.senate;
  const memberByName = Object.fromEntries(council.map((m) => [m.name, m]));

  return (
    <article className="mx-auto max-w-4xl" data-testid="verdict-layout">
      {/* Question reprint */}
      <div className="mb-10 border-l-2 pl-6 md:pl-8" style={{ borderColor: t.accent }}>
        <p className="smallcaps mb-2 text-ash">The Question Brought</p>
        <p
          className="cortex-display italic text-2xl md:text-3xl text-bone leading-snug"
          data-testid="verdict-question"
        >
          {verdict.question}
        </p>
      </div>

      <div className="hairline mb-10" />

      {/* Deliberation */}
      <div className="mb-12 space-y-6" data-testid="verdict-deliberation">
        <p className="smallcaps text-ash">Deliberation</p>
        {verdict.deliberation.map((d, i) => {
          const member = memberByName[d.member];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`relative border bg-carbon/70 p-6 md:p-7 ${
                d.dissent ? "" : ""
              }`}
              style={{
                borderColor: d.dissent ? "#8B1A1A" : "#2A2A36",
                borderLeftWidth: d.dissent ? 3 : 1,
                borderRadius: 2,
              }}
              data-testid={`deliberation-card-${i}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center border"
                  style={{
                    borderColor: t.accent + "55",
                    color: t.accent,
                    borderRadius: 2,
                  }}
                >
                  <Glyph name={member?.glyph || "laurel"} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h5
                      className="cortex-display text-xl text-pearl"
                      style={{ fontWeight: 600 }}
                    >
                      {d.member}
                    </h5>
                    <div className="flex items-baseline gap-3">
                      {member?.dates && (
                        <span className="smallcaps tabular text-ash whitespace-nowrap">
                          {member.dates}
                        </span>
                      )}
                      {d.dissent && (
                        <span className="smallcaps text-[#E89A9A]" data-testid="dissent-marker">
                          Dissent
                        </span>
                      )}
                    </div>
                  </div>
                  {member?.lineage && (
                    <p className="smallcaps mt-0.5" style={{ color: t.accent, opacity: 0.85 }}>
                      {member.lineage}
                    </p>
                  )}
                  <p className="cortex-editorial mt-3 text-[1.02rem] leading-relaxed text-bone/90">
                    {d.contribution}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Verdict */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: (verdict.deliberation.length + 1) * 0.2,
          duration: 0.7,
        }}
        className="relative mt-16"
        data-testid="verdict-text-section"
      >
        <div
          className="absolute -top-8 left-0 right-0 hairline"
          style={{ background: `linear-gradient(90deg, transparent, ${t.accent}88, transparent)` }}
        />
        <p
          className="smallcaps mb-4"
          style={{ color: t.accent }}
        >
          Verdict — {verdict.chamber}
        </p>
        <div
          className="cortex-editorial dropcap text-[1.18rem] leading-[1.85] text-bone"
          style={{ "--cap-color": t.accent }}
          data-testid="verdict-text"
        >
          {verdict.verdict}
        </div>
      </motion.section>

      {showActions && (
        <div className="mt-14 flex flex-wrap items-center gap-3" data-testid="verdict-actions">
          {children}
        </div>
      )}
    </article>
  );
}

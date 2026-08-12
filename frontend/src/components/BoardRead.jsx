// One commander's read of the brief.
//
// Every card carries the falsifier — `if_wrong` — because a read you cannot
// check against events is a prediction, not an estimate.
import React from "react";
import { motion } from "framer-motion";

import { Glyph } from "./Glyphs";

const ACCENT = "#D6C08A";

// Doctrine tags come from the roster, not the model — they orient the reader
// before the prose does.
export const MEMBER_META = {
  "Alexander the Great": { glyph: "sword", dates: "356–323 BC", doctrine: "Speed · decisive engagement" },
  "Genghis Khan": { glyph: "eye", dates: "c. 1162–1227", doctrine: "Intelligence · mobility · coercion" },
  "Napoleon Bonaparte": { glyph: "eagle", dates: "1769–1821", doctrine: "Mass · tempo · the decisive point" },
  "Winston Churchill": { glyph: "compass", dates: "1874–1965", doctrine: "Coalitions · the long war" },
  "Dwight D. Eisenhower": { glyph: "shield", dates: "1890–1969", doctrine: "Alliance · logistics · restraint" },
};

export default function BoardRead({ row, index = 0 }) {
  const meta = MEMBER_META[row.member] || { glyph: "laurel", dates: "", doctrine: "" };

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.09 }}
      className="border p-6"
      style={{
        borderColor: row.dissent ? "#D08C7A55" : "#2A2A36",
        background: "rgba(20,20,28,0.72)",
        borderRadius: 3,
      }}
      data-testid={`board-read-${index}`}
    >
      <header className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center border"
          style={{
            borderColor: `${ACCENT}55`,
            color: ACCENT,
            borderRadius: 2,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05), transparent 70%)",
          }}
        >
          <Glyph name={meta.glyph} size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="cortex-display text-xl leading-snug text-pearl" style={{ fontWeight: 600 }}>
              {row.member}
            </h3>
            <span className="smallcaps tabular whitespace-nowrap text-ash">{meta.dates}</span>
          </div>
          <p className="smallcaps mt-0.5" style={{ color: ACCENT, opacity: 0.85 }}>
            {meta.doctrine}
          </p>
        </div>
        {row.dissent && (
          <span
            className="smallcaps shrink-0 border px-2 py-0.5"
            style={{ borderColor: "#D08C7A", color: "#D08C7A", borderRadius: 2, fontSize: "0.68rem" }}
            data-testid="dissent-badge"
          >
            dissents
          </span>
        )}
      </header>

      <p className="cortex-editorial mt-5 text-[0.97rem] leading-relaxed text-bone">{row.read}</p>

      {row.next_moves?.length > 0 && (
        <div className="mt-5">
          <p className="smallcaps text-ash">Would counsel</p>
          <ol className="mt-2 space-y-2">
            {row.next_moves.map((move, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular mt-0.5 text-xs" style={{ color: ACCENT }}>
                  {i + 1}
                </span>
                <span className="cortex-editorial text-sm leading-relaxed text-bone/85">{move}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <dl className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: "#2A2A36" }}>
        <Row label="Turns on" value={row.decisive_factor} />
        <Row label="Wrong if" value={row.if_wrong} tone="#9FB5C4" />
        <Row label="Fatal risk" value={row.risk} tone="#D08C7A" />
      </dl>
    </motion.article>
  );
}

function Row({ label, value, tone }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="smallcaps w-24 shrink-0" style={{ color: tone || "#6B6B78" }}>
        {label}
      </dt>
      <dd className="cortex-editorial text-sm leading-relaxed text-bone/80">{value}</dd>
    </div>
  );
}

import React from "react";
import { Glyph } from "./Glyphs";
import { CHAMBER_THEME } from "@/lib/chambers";

export default function CouncilMemberCard({ member, chamberId, compact = false }) {
  const t = CHAMBER_THEME[chamberId];
  return (
    <div
      className="group relative flex items-start gap-4 border border-slate/70 bg-carbon/85 px-5 py-5 transition-colors duration-500 hover:border-bone/30"
      style={{ borderRadius: 4 }}
      data-testid={`council-member-${member.id}`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center border"
        style={{
          borderColor: t.accent + "55",
          color: t.accent,
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05), transparent 70%)",
          borderRadius: 2,
        }}
      >
        <Glyph name={member.glyph} size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h4
            className="cortex-display text-lg leading-snug text-pearl"
            style={{ fontWeight: 600 }}
          >
            {member.name}
          </h4>
        </div>
        <p
          className="smallcaps mt-0.5"
          style={{ color: t.accent, opacity: 0.85 }}
        >
          {member.lineage}
        </p>
        {!compact && (
          <p className="cortex-editorial mt-3 text-sm leading-relaxed text-bone/75">
            {member.voice_notes}
          </p>
        )}
      </div>
    </div>
  );
}

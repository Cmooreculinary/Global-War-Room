import React from "react";
import { CHAMBER_THEME } from "@/lib/chambers";
import { Glyph } from "./Glyphs";

const QUADRANT_LAYOUT = [
  { id: "senate", x: 0, y: 0 },
  { id: "boardroom", x: 1, y: 0 },
  { id: "courtroom", x: 0, y: 1 },
  { id: "council", x: 1, y: 1 },
];

const GLYPH_BY_CHAMBER = {
  senate: "laurel",
  boardroom: "ledger",
  courtroom: "hearth",
  council: "book",
};

export default function ForgeQuadrant({ activeChambers = [], called = [] }) {
  // activeChambers: predicted (preview); called: actually used in deliberation
  const isCalled = (id) => called.includes(id);
  const isActive = (id) => activeChambers.includes(id) || isCalled(id);

  return (
    <div className="relative" data-testid="forge-quadrant">
      <div className="grid grid-cols-2 gap-3">
        {QUADRANT_LAYOUT.map(({ id }) => {
          const t = CHAMBER_THEME[id];
          const active = isActive(id);
          const wasCalled = isCalled(id);
          return (
            <div
              key={id}
              className="relative border px-4 py-4 transition-all duration-500"
              data-testid={`quadrant-${id}`}
              style={{
                borderColor: active ? t.accent : "#2A2A36",
                background: active
                  ? `linear-gradient(135deg, ${t.primary}22, transparent 60%)`
                  : "rgba(20,20,28,0.6)",
                borderRadius: 2,
                boxShadow: wasCalled ? `0 0 24px ${t.glowRgba}` : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center border"
                  style={{
                    color: active ? t.accent : "#6B6B78",
                    borderColor: active ? t.accent + "88" : "#2A2A36",
                    borderRadius: 2,
                  }}
                >
                  <Glyph name={GLYPH_BY_CHAMBER[id]} size={20} />
                </div>
                <div className="min-w-0">
                  <p
                    className="cortex-display text-sm md:text-base"
                    style={{ color: active ? "#F5F2EC" : "#6B6B78", fontWeight: 600 }}
                  >
                    {t.name}
                  </p>
                  <p className="smallcaps" style={{ color: active ? t.accent : "#6B6B78", opacity: 0.85 }}>
                    {wasCalled ? "Called" : active ? "Listening" : "Quiet"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

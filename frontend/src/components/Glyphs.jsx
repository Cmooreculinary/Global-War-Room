// Symbolic SVG glyphs for council member archetypes.
// Sharp, classical vectors. Render in `currentColor` so callers control hue.
import React from "react";

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Wrap = ({ size = 28, children }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" {...base}>
    {children}
  </svg>
);

export const LaurelGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 4 C 10 8, 7 14, 7 22 M16 4 C 22 8, 25 14, 25 22" />
    <path d="M9 10 q 2 2 4 0 M9 14 q 2 2 4 0 M10 18 q 2 2 4 0" />
    <path d="M23 10 q -2 2 -4 0 M23 14 q -2 2 -4 0 M22 18 q -2 2 -4 0" />
    <path d="M16 22 v 6" />
  </Wrap>
);

export const ScalesGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 5 v 22" />
    <path d="M6 11 h 20" />
    <path d="M6 11 l -3 6 q 3 2 6 0 z" />
    <path d="M26 11 l -3 6 q 3 2 6 0 z" />
    <path d="M11 27 h 10" />
  </Wrap>
);

export const ShieldGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 4 L 26 8 V 17 C 26 23, 21 27, 16 28 C 11 27, 6 23, 6 17 V 8 Z" />
    <path d="M16 11 v 10 M11 16 h 10" />
  </Wrap>
);

export const CompassGlyph = (p) => (
  <Wrap {...p}>
    <circle cx="16" cy="16" r="11" />
    <path d="M16 7 L 19 16 L 16 25 L 13 16 Z" />
    <circle cx="16" cy="16" r="1.2" fill="currentColor" />
  </Wrap>
);

export const LedgerGlyph = (p) => (
  <Wrap {...p}>
    <path d="M7 5 h 18 v 22 h -18 z" />
    <path d="M11 11 h 10 M11 15 h 10 M11 19 h 7" />
    <path d="M7 5 q -2 11 0 22" />
  </Wrap>
);

export const HammerGlyph = (p) => (
  <Wrap {...p}>
    <rect x="6" y="6" width="14" height="6" rx="0.6" />
    <path d="M11 12 v 14 M14 12 v 14" />
    <path d="M20 9 h 6" />
  </Wrap>
);

export const TreeGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 4 C 10 8, 9 14, 12 16 C 8 17, 7 22, 12 23 H 20 C 25 22, 24 17, 20 16 C 23 14, 22 8, 16 4 Z" />
    <path d="M16 16 v 12" />
  </Wrap>
);

export const HearthGlyph = (p) => (
  <Wrap {...p}>
    <path d="M5 26 V 13 L 16 5 L 27 13 V 26 Z" />
    <path d="M11 26 V 18 q 5 -3 10 0 V 26" />
    <path d="M14 22 q 2 -3 4 0" />
  </Wrap>
);

export const LanternGlyph = (p) => (
  <Wrap {...p}>
    <path d="M11 7 h 10 v 4 h -10 z" />
    <path d="M9 11 h 14 v 14 h -14 z" />
    <path d="M16 13 v 10" />
    <path d="M12 18 h 8" />
    <path d="M16 25 v 3" />
  </Wrap>
);

export const EyeGlyph = (p) => (
  <Wrap {...p}>
    <path d="M3 16 C 7 10, 11 8, 16 8 C 21 8, 25 10, 29 16 C 25 22, 21 24, 16 24 C 11 24, 7 22, 3 16 Z" />
    <circle cx="16" cy="16" r="3.5" />
    <circle cx="16" cy="16" r="1.2" fill="currentColor" />
  </Wrap>
);

export const BookGlyph = (p) => (
  <Wrap {...p}>
    <path d="M5 6 q 5 -1 11 2 q 6 -3 11 -2 v 18 q -5 -1 -11 2 q -6 -3 -11 -2 z" />
    <path d="M16 8 v 18" />
  </Wrap>
);

export const ShepherdCrookGlyph = (p) => (
  <Wrap {...p}>
    <path d="M19 5 q 6 0 6 6 q 0 6 -6 6 q -4 0 -4 -4" />
    <path d="M15 13 v 16" />
  </Wrap>
);

export const FlameGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 4 q 2 5 6 9 q 4 4 4 9 q 0 6 -10 6 q -10 0 -10 -6 q 0 -3 4 -7 q 4 -4 6 -11 z" />
    <path d="M16 14 q 2 3 4 6 q 0 4 -4 4 q -4 0 -4 -4 q 2 -3 4 -6 z" />
  </Wrap>
);

export const HaloGlyph = (p) => (
  <Wrap {...p}>
    <ellipse cx="16" cy="9" rx="9" ry="3" />
    <path d="M10 16 q 0 -4 6 -4 q 6 0 6 4 v 12 h -12 z" />
    <circle cx="16" cy="20" r="0.8" fill="currentColor" />
  </Wrap>
);

export const AnvilGlyph = (p) => (
  <Wrap {...p}>
    <path d="M3 11 h 26 q -2 5 -8 5 H 11 Q 5 16, 3 11 Z" />
    <path d="M11 16 v 5 H 21 V 16" />
    <path d="M9 21 h 14 v 4 h -14 z" />
  </Wrap>
);

export const PillarGlyph = (p) => (
  <Wrap {...p}>
    <path d="M9 5 h 14 v 3 h -14 z" />
    <path d="M11 8 v 16" />
    <path d="M15 8 v 16" />
    <path d="M19 8 v 16" />
    <path d="M7 24 h 18 v 3 h -18 z" />
  </Wrap>
);

export const OwlGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 5 q -8 0 -8 9 q 0 9 8 12 q 8 -3 8 -12 q 0 -9 -8 -9 z" />
    <circle cx="13" cy="13" r="2.6" />
    <circle cx="19" cy="13" r="2.6" />
    <circle cx="13" cy="13" r="0.9" fill="currentColor" />
    <circle cx="19" cy="13" r="0.9" fill="currentColor" />
    <path d="M14.5 17 q 1.5 1.5 3 0" />
    <path d="M16 5 l -2 -2 M16 5 l 2 -2" />
  </Wrap>
);

export const SwordGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 3 l 3 4 v 13 h -6 V 7 z" />
    <path d="M9 21 h 14" />
    <path d="M16 21 v 6" />
    <path d="M13 27 h 6" />
  </Wrap>
);

export const EagleGlyph = (p) => (
  <Wrap {...p}>
    <path d="M16 9 q -3 -4 -9 -4 q 3 4 3 8 q -4 0 -6 2 q 5 2 7 6" />
    <path d="M16 9 q 3 -4 9 -4 q -3 4 -3 8 q 4 0 6 2 q -5 2 -7 6" />
    <path d="M16 8 v 15" />
    <path d="M13 26 h 6" />
    <circle cx="16" cy="6" r="1.8" />
  </Wrap>
);

export const ScrollGlyph = (p) => (
  <Wrap {...p}>
    <path d="M8 7 q 0 -3 3 -3 h 13 q -2 2 -2 5 v 14 q 0 3 -3 3 H 8" />
    <path d="M8 26 q 3 0 3 -3 V 9" />
    <path d="M14 11 h 6 M14 15 h 6 M14 19 h 4" />
  </Wrap>
);

export const GLYPHS = {
  laurel: LaurelGlyph,
  sword: SwordGlyph,
  eagle: EagleGlyph,
  scroll: ScrollGlyph,
  scales: ScalesGlyph,
  shield: ShieldGlyph,
  compass: CompassGlyph,
  ledger: LedgerGlyph,
  hammer: HammerGlyph,
  tree: TreeGlyph,
  hearth: HearthGlyph,
  lantern: LanternGlyph,
  eye: EyeGlyph,
  book: BookGlyph,
  shepherd_crook: ShepherdCrookGlyph,
  flame: FlameGlyph,
  halo: HaloGlyph,
  anvil: AnvilGlyph,
  pillar: PillarGlyph,
  owl: OwlGlyph,
};

export function Glyph({ name, size = 28, className = "" }) {
  const G = GLYPHS[name] || LaurelGlyph;
  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <G size={size} />
    </span>
  );
}

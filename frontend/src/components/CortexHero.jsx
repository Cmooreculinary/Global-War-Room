// CortexHero — uses the user-provided lateral brain image as the hero,
// with absolutely-positioned interactive lobe hotspots over the cortex.
//
// Three modes:
//   "idle"         — all lobes equally lit, hover/click enabled
//   "deliberating" — only `activeChambers` blaze; others dim to ~25%; pulse intensifies
//   "verdict"      — only `activeChambers` glow steadily (no pulse); others dim
//
// All coordinates are PERCENTAGES of the square image box.
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";

const REGIONS = [
  { id: "senate", label: "Senate", biology: "Frontal Lobe", hot: { x: 30, y: 38, r: 11 }, lab: { x: 16, y: 22 }, align: "right" },
  { id: "boardroom", label: "Boardroom", biology: "Parietal Lobe", hot: { x: 56, y: 22, r: 11 }, lab: { x: 56, y: 7 }, align: "center" },
  { id: "courtroom", label: "Court Room", biology: "Temporal Lobe", hot: { x: 40, y: 64, r: 10 }, lab: { x: 22, y: 80 }, align: "right" },
  { id: "council", label: "Council", biology: "Occipital Lobe", hot: { x: 80, y: 50, r: 11 }, lab: { x: 92, y: 50 }, align: "left" },
];

const FORGE = { x: 53, y: 44, r: 6, lab: { x: 53, y: 70 } };

// Cycle order for the idle "demo" loop — each lobe lights up in turn.
const DEMO_CYCLE = ["senate", "boardroom", "courtroom", "council", "forge"];
const DEMO_INTERVAL_MS = 1800;

export default function CortexHero({
  className = "",
  mode = "idle",
  activeChambers = [],
  onLobeClick,
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const [demoIdx, setDemoIdx] = useState(0);
  const brain = getImage("brain_hero");

  const interactive = mode === "idle";

  // Idle demo-cycle: tick a cursor through DEMO_CYCLE so the brain self-demos.
  // Pause when the user hovers a lobe.
  useEffect(() => {
    if (!interactive || hovered) return undefined;
    const id = setInterval(
      () => setDemoIdx((i) => (i + 1) % DEMO_CYCLE.length),
      DEMO_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [interactive, hovered]);

  const demoActiveId = interactive && !hovered ? DEMO_CYCLE[demoIdx] : null;

  const handleClick = useCallback(
    (id) => {
      if (!interactive) return;
      if (onLobeClick) {
        onLobeClick(id);
        return;
      }
      if (id === "forge") navigate("/forge");
      else navigate(`/chamber/${id}`);
    },
    [interactive, onLobeClick, navigate]
  );

  const isActive = useCallback((id) => activeChambers.includes(id), [activeChambers]);
  const dim = useCallback(
    (id) => mode !== "idle" && !isActive(id),
    [mode, isActive]
  );

  return (
    <div
      className={`relative mx-auto w-full max-w-[640px] aspect-square ${className}`}
      data-testid="cortex-hero"
      data-mode={mode}
    >
      <Aureole />
      <BrainImage src={brain} />
      <BreathingVeil />

      {REGIONS.map((r) => (
        <LobeHotspot
          key={r.id}
          region={r}
          mode={mode}
          interactive={interactive}
          hovered={hovered}
          setHovered={setHovered}
          isActive={isActive(r.id)}
          isDemo={demoActiveId === r.id}
          onClick={handleClick}
        />
      ))}

      {REGIONS.map((r) => (
        <LobeLabel
          key={`label-${r.id}`}
          region={r}
          mode={mode}
          interactive={interactive}
          hovered={hovered}
          isActive={isActive(r.id)}
          isDim={dim(r.id)}
          isDemo={demoActiveId === r.id}
        />
      ))}

      <ForgeOrb
        mode={mode}
        interactive={interactive}
        hovered={hovered}
        setHovered={setHovered}
        isActive={isActive("forge")}
        isDim={dim("forge")}
        isDemo={demoActiveId === "forge"}
        onClick={handleClick}
      />
      <ForgeLabel
        mode={mode}
        hovered={hovered}
        isActive={isActive("forge")}
        isDim={dim("forge")}
        isDemo={demoActiveId === "forge"}
      />
      <HoverCaption
        mode={mode}
        hovered={hovered}
        activeChambers={activeChambers}
        demoActiveId={demoActiveId}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Sub-components — extracted so the main component stays small and testable.  //
// --------------------------------------------------------------------------- //

function Aureole() {
  return (
    <div
      className="pointer-events-none absolute inset-[-15%]"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(201,169,97,0.10), rgba(200,74,31,0.06) 28%, transparent 60%)",
      }}
    />
  );
}

function BrainImage({ src }) {
  return (
    <motion.img
      data-img="brain_hero"
      src={src}
      alt="The Cerebral Cortex — five chambers"
      className="absolute inset-0 h-full w-full object-contain select-none"
      draggable={false}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{
        filter:
          "drop-shadow(0 0 50px rgba(123, 60, 200, 0.18)) drop-shadow(0 0 22px rgba(255,229,180,0.10))",
      }}
    />
  );
}

function BreathingVeil() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,229,180,0.05), transparent 55%)",
      }}
      animate={{ opacity: [0.4, 0.9, 0.4] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function LobeHotspot({ region, mode, interactive, hovered, setHovered, isActive, isDemo, onClick }) {
  const t = CHAMBER_THEME[region.id];
  const blazing = (mode !== "idle" && isActive) || isDemo;
  const isHover = hovered === region.id && interactive;
  const showGlow = isHover || blazing;
  const onEnter = () => interactive && setHovered(region.id);
  const onLeave = () => interactive && setHovered(null);

  return (
    <button
      type="button"
      onClick={() => onClick(region.id)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      data-testid={`lobe-${region.id}`}
      className={`absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none ${
        interactive ? "cursor-pointer" : "cursor-default pointer-events-none"
      }`}
      style={{
        left: `${region.hot.x}%`,
        top: `${region.hot.y}%`,
        width: `${region.hot.r * 2}%`,
        height: `${region.hot.r * 2}%`,
        borderRadius: "50%",
        background: showGlow
          ? `radial-gradient(circle, ${t.primary}66 0%, ${t.primary}22 40%, transparent 72%)`
          : `radial-gradient(circle, ${t.primary}1A 0%, transparent 70%)`,
        boxShadow: showGlow ? `0 0 50px 10px ${t.glowRgba}` : "none",
        transition: "background 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      <PulsingRing theme={t} blazing={blazing} isHover={isHover} showGlow={showGlow} />
    </button>
  );
}

function PulsingRing({ theme, blazing, isHover, showGlow }) {
  return (
    <motion.span
      aria-hidden
      className="absolute inset-[12%] rounded-full border"
      style={{
        borderColor: blazing ? theme.accent : isHover ? theme.accent + "BB" : "transparent",
        boxShadow: showGlow ? `inset 0 0 28px ${theme.glowRgba}` : "none",
      }}
      animate={
        blazing
          ? {
              boxShadow: [
                `inset 0 0 18px ${theme.glowRgba}, 0 0 14px ${theme.glowRgba}`,
                `inset 0 0 36px ${theme.glowRgba}, 0 0 36px ${theme.glowRgba}`,
                `inset 0 0 18px ${theme.glowRgba}, 0 0 14px ${theme.glowRgba}`,
              ],
              scale: [1, 1.06, 1],
            }
          : { scale: 1 }
      }
      transition={
        blazing
          ? { duration: 2.0, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.4 }
      }
    />
  );
}

function LobeLabel({ region, mode, interactive, hovered, isActive, isDim, isDemo }) {
  const t = CHAMBER_THEME[region.id];
  const blazing = (mode !== "idle" && isActive) || isDemo;
  const isHover = hovered === region.id && interactive;
  const align =
    region.align === "left"
      ? "items-start text-left"
      : region.align === "right"
      ? "items-end text-right"
      : "items-center text-center";
  const translate =
    region.align === "left"
      ? "translate(0, -50%)"
      : region.align === "right"
      ? "translate(-100%, -50%)"
      : "translate(-50%, -50%)";
  const isLit = blazing || isHover;

  return (
    <div
      className={`pointer-events-none absolute flex flex-col whitespace-nowrap ${align}`}
      style={{
        left: `${region.lab.x}%`,
        top: `${region.lab.y}%`,
        transform: translate,
        transition: "opacity 0.45s ease, transform 0.45s ease",
        opacity: isDim ? 0.22 : isLit ? 1 : 0.78,
      }}
    >
      <span
        className="cortex-display italic"
        style={{
          fontSize: isLit ? "1.5rem" : "1.25rem",
          color: isLit ? "#F5F2EC" : t.accent,
          textShadow: "0 1px 10px rgba(10,10,15,0.95), 0 0 18px rgba(10,10,15,0.85)",
          fontWeight: 600,
          lineHeight: 1.1,
          transition: "all 0.35s ease",
        }}
      >
        {region.label}
      </span>
      <span
        className="smallcaps mt-0.5"
        style={{
          color: "#E8E4DC",
          opacity: isLit ? 0.95 : 0.55,
          textShadow: "0 1px 6px rgba(10,10,15,0.95)",
        }}
      >
        {region.biology}
      </span>
      <span
        className="cortex-editorial italic mt-1"
        style={{
          fontSize: "0.78rem",
          color: t.accent,
          opacity: isLit ? 0.95 : 0.65,
          textShadow: "0 1px 6px rgba(10,10,15,0.95)",
          letterSpacing: "0.01em",
        }}
      >
        {t.description}
      </span>
    </div>
  );
}

function ForgeOrb({ mode, interactive, hovered, setHovered, isActive, isDim, isDemo, onClick }) {
  const onEnter = () => interactive && setHovered("forge");
  const onLeave = () => interactive && setHovered(null);
  const isLit = (mode !== "idle" && isActive) || isDemo;
  const isHover = hovered === "forge";

  return (
    <button
      type="button"
      onClick={() => onClick("forge")}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-testid="lobe-forge"
      className={`absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none ${
        interactive ? "cursor-pointer" : "cursor-default pointer-events-none"
      }`}
      style={{
        left: `${FORGE.x}%`,
        top: `${FORGE.y}%`,
        width: `${FORGE.r * 2}%`,
        height: `${FORGE.r * 2}%`,
        borderRadius: "50%",
        opacity: isDim && mode !== "idle" ? 0.35 : 1,
        transition: "opacity 0.45s ease",
      }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, #FFE5B4 0%, #C84A1F 38%, rgba(200,74,31,0.45) 65%, transparent 80%)",
          mixBlendMode: "screen",
        }}
        animate={{
          scale: isLit ? [1, 1.18, 1] : isHover ? [1, 1.12, 1] : [0.9, 1.06, 0.9],
          opacity: isLit ? [0.85, 1, 0.85] : isHover ? 1 : [0.78, 1, 0.78],
        }}
        transition={{
          duration: isLit ? 1.6 : 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </button>
  );
}

function ForgeLabel({ mode, hovered, isActive, isDim, isDemo }) {
  const isLit = (mode !== "idle" && isActive) || hovered === "forge" || isDemo;
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center text-center whitespace-nowrap"
      style={{
        left: `${FORGE.lab.x}%`,
        top: `${FORGE.lab.y}%`,
        transform: "translate(-50%, -50%)",
        opacity: isDim ? 0.22 : 1,
        transition: "opacity 0.45s ease",
      }}
    >
      <span
        className="cortex-display italic"
        style={{
          color: "#FFE5B4",
          fontWeight: 700,
          fontSize: isLit ? "1.55rem" : "1.35rem",
          textShadow: "0 0 16px rgba(200,74,31,0.85), 0 1px 10px rgba(10,10,15,0.95)",
          transition: "font-size 0.35s ease",
          lineHeight: 1.05,
        }}
      >
        The Forge
      </span>
      <span
        className="smallcaps mt-0.5"
        style={{ color: "#FFE5B4", opacity: 0.8, textShadow: "0 1px 6px rgba(10,10,15,0.95)" }}
      >
        Corpus Callosum
      </span>
      <span
        className="cortex-editorial italic mt-1"
        style={{
          fontSize: "0.78rem",
          color: "#FFE5B4",
          opacity: 0.8,
          textShadow: "0 1px 6px rgba(10,10,15,0.95)",
        }}
      >
        {CHAMBER_THEME.forge.description}
      </span>
    </div>
  );
}

function HoverCaption({ mode, hovered, activeChambers, demoActiveId }) {
  const text = captionText(mode, hovered, activeChambers, demoActiveId);
  const visible = !!hovered || mode !== "idle" || !!demoActiveId;
  return (
    <div
      className="absolute -bottom-2 left-0 right-0 text-center smallcaps text-ash transition-opacity duration-500"
      style={{ opacity: visible ? 0.85 : 0 }}
      data-testid="cortex-hover-caption"
    >
      {text}
    </div>
  );
}

function captionText(mode, hovered, activeChambers, demoActiveId) {
  if (hovered) {
    const t = CHAMBER_THEME[hovered];
    return `${t.name} — ${t.description}`;
  }
  if (mode === "deliberating" && activeChambers.length > 0) {
    return activeChambers.length === 1
      ? `${CHAMBER_THEME[activeChambers[0]].name} is convening`
      : "A committee is in session";
  }
  if (mode === "verdict" && activeChambers.length > 0) {
    return `Chaired by ${CHAMBER_THEME[activeChambers[0]].name}`;
  }
  if (demoActiveId) {
    const t = CHAMBER_THEME[demoActiveId];
    return `${t.name} — ${t.description}`;
  }
  return "";
}

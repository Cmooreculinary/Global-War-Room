// DeliberationCortex — the loading state.
// Shows a small pulsing brain image with chamber-color halo, four lobe markers
// that glow when their chamber is part of an active committee, and a rotating
// chamber-flavored status line beneath.
//
// Note: we don't get streaming progress from the backend, so committee status
// is inferred client-side: after ~9s with no response, we soft-promote the UI
// to "Committee forming…" — purely cosmetic; the real witness list arrives
// with the verdict response.

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";
import { CONVENING_MESSAGES, getChamberMessages } from "@/lib/loadingMessages";

const LOBE_DOTS = {
  senate: { x: 30, y: 38 },
  boardroom: { x: 56, y: 22 },
  courtroom: { x: 40, y: 64 },
  council: { x: 80, y: 50 },
  forge: { x: 53, y: 44 },
};

const ALL_CHAMBERS = ["senate", "boardroom", "courtroom", "council"];

function computePhase(elapsed, chamberId, presumeCommittee) {
  if (chamberId === "forge") {
    if (elapsed < 3) return "convening";
    if (elapsed < 12) return "committee";
    return "synthesis";
  }
  if (presumeCommittee) {
    if (elapsed < 3) return "convening";
    if (elapsed < 14) return "committee";
    return "synthesis";
  }
  return elapsed < 3 ? "convening" : "chamber";
}

function statusLabel(phase, chamberName) {
  switch (phase) {
    case "convening":
      return "Convening";
    case "chamber":
      return `${chamberName} in session`;
    case "committee":
      return "Committee in session";
    case "synthesis":
      return "Verdict taking shape";
    default:
      return "Convening";
  }
}

export default function DeliberationCortex({ chamberId, presumeCommittee = false }) {
  const t = CHAMBER_THEME[chamberId];
  const brain = getImage("brain_hero");
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  // Tick a 1s timer to drive elapsed-time-based UI state.
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, []);

  const phase = useMemo(
    () => computePhase(elapsed, chamberId, presumeCommittee),
    [elapsed, chamberId, presumeCommittee]
  );

  // Reset and rotate the message every ~3.2s when the phase changes.
  useEffect(() => {
    setMsgIdx(0);
    const id = setInterval(() => setMsgIdx((i) => i + 1), 3200);
    return () => clearInterval(id);
  }, [phase]);

  const messages = useMemo(() => {
    if (phase === "convening") return CONVENING_MESSAGES;
    const isCommittee =
      phase === "committee" || phase === "synthesis" || chamberId === "forge";
    return getChamberMessages(chamberId, isCommittee);
  }, [phase, chamberId]);

  const status = messages[msgIdx % messages.length];

  // Which lobes glow during the loading? Always the home chamber. During
  // committee/synthesis, glow the other chambers softly to suggest the committee.
  const activeChambers = useMemo(() => {
    if (chamberId === "forge") return ALL_CHAMBERS;
    if (phase === "committee" || phase === "synthesis") return ALL_CHAMBERS;
    return [chamberId];
  }, [chamberId, phase]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center" data-testid="deliberation-cortex">
      <CortexLoadingArt
        brain={brain}
        chamberId={chamberId}
        accentGlow={t.glowRgba}
        activeChambers={activeChambers}
      />
      <DeliberationStatus
        accent={t.accent}
        chamberName={t.name}
        phase={phase}
        status={status}
        elapsed={elapsed}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Sub-components — extracted so the main component stays small and testable.  //
// --------------------------------------------------------------------------- //

function CortexLoadingArt({ brain, chamberId, accentGlow, activeChambers }) {
  return (
    <div className="relative w-full max-w-[440px] aspect-square">
      <motion.div
        className="pointer-events-none absolute inset-[-15%]"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentGlow}, transparent 55%)`,
        }}
        animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.95, 1.05, 0.95] }}
        transition={{
          duration: chamberId === "forge" ? 2.4 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.img
        data-img="brain_hero"
        src={brain}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
        animate={{ opacity: [0.85, 1, 0.85], scale: [0.985, 1.01, 0.985] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          filter: `drop-shadow(0 0 32px ${accentGlow}) drop-shadow(0 0 16px rgba(255,229,180,0.10))`,
        }}
      />

      {ALL_CHAMBERS.map((cid) => (
        <LobeMarker
          key={cid}
          chamberId={cid}
          isHome={cid === chamberId}
          isActive={activeChambers.includes(cid)}
        />
      ))}

      <ForgeEmber prominent={chamberId === "forge"} />
    </div>
  );
}

function LobeMarker({ chamberId, isHome, isActive }) {
  const ct = CHAMBER_THEME[chamberId];
  const dot = LOBE_DOTS[chamberId];
  const size = isHome ? 28 : 18;
  return (
    <motion.div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${dot.x}%`,
        top: `${dot.y}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${ct.primary}88 0%, ${ct.primary}33 50%, transparent 80%)`,
        boxShadow: isActive ? `0 0 24px ${ct.glowRgba}` : "none",
      }}
      animate={{
        opacity: isActive ? [0.6, 1, 0.6] : 0.18,
        scale: isActive ? [0.85, 1.15, 0.85] : 0.8,
      }}
      transition={{
        duration: isHome ? 2.0 : 2.6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: isHome ? 0 : 0.3 + ALL_CHAMBERS.indexOf(chamberId) * 0.18,
      }}
    />
  );
}

function ForgeEmber({ prominent }) {
  const size = prominent ? 60 : 30;
  return (
    <motion.div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${LOBE_DOTS.forge.x}%`,
        top: `${LOBE_DOTS.forge.y}%`,
        width: size,
        height: size,
        background:
          "radial-gradient(circle, #FFE5B4 0%, #C84A1F 40%, rgba(200,74,31,0.45) 65%, transparent 80%)",
        mixBlendMode: "screen",
      }}
      animate={{ opacity: [0.65, 1, 0.65], scale: [0.9, 1.1, 0.9] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function DeliberationStatus({ accent, chamberName, phase, status, elapsed }) {
  return (
    <div className="mt-8 text-center" data-testid="deliberation-status">
      <p className="smallcaps" style={{ color: accent, opacity: 0.9 }}>
        {statusLabel(phase, chamberName)}
      </p>
      <motion.p
        key={`${phase}-${status}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="cortex-display italic mt-2 text-2xl text-pearl md:text-3xl"
      >
        {status}
      </motion.p>
      <p className="cortex-editorial mt-3 text-sm text-bone/55 tabular">
        {elapsed}s · this may take a moment.
      </p>
    </div>
  );
}

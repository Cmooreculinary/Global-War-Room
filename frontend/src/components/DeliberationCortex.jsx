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

export default function DeliberationCortex({ chamberId, presumeCommittee = false }) {
  const t = CHAMBER_THEME[chamberId];
  const brain = getImage("brain_hero");
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState("convening");
  const [msgIdx, setMsgIdx] = useState(0);

  // Tick a 1s timer to drive elapsed-time-based UI state
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, []);

  // Phase transitions based on elapsed seconds
  useEffect(() => {
    if (chamberId === "forge") {
      // Forge is always a committee
      if (elapsed < 3) setPhase("convening");
      else if (elapsed < 12) setPhase("committee");
      else setPhase("synthesis");
    } else if (presumeCommittee) {
      if (elapsed < 3) setPhase("convening");
      else if (elapsed < 14) setPhase("committee");
      else setPhase("synthesis");
    } else {
      // Single-chamber presumed: stay in chamber phase
      if (elapsed < 3) setPhase("convening");
      else setPhase("chamber");
    }
  }, [elapsed, chamberId, presumeCommittee]);

  // Rotate the message every ~3.2s
  useEffect(() => {
    setMsgIdx(0);
    const id = setInterval(() => setMsgIdx((i) => i + 1), 3200);
    return () => clearInterval(id);
  }, [phase]);

  const messages = useMemo(() => {
    if (phase === "convening") return CONVENING_MESSAGES;
    return getChamberMessages(chamberId, phase === "committee" || phase === "synthesis" || chamberId === "forge");
  }, [phase, chamberId]);

  const status = messages[msgIdx % messages.length];

  // Which lobes glow during the loading? Always the home chamber. During committee/synthesis,
  // also glow the other chambers softly to suggest the committee.
  const activeChambers = useMemo(() => {
    if (chamberId === "forge") return ALL_CHAMBERS;
    if (phase === "committee" || phase === "synthesis") return ALL_CHAMBERS;
    return [chamberId];
  }, [chamberId, phase]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center" data-testid="deliberation-cortex">
      <div className="relative w-full max-w-[440px] aspect-square">
        {/* Outer aureole — pulses with chamber color */}
        <motion.div
          className="pointer-events-none absolute inset-[-15%]"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${t.glowRgba}, transparent 55%)`,
          }}
          animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: chamberId === "forge" ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Brain image */}
        <motion.img
          data-img="brain_hero"
          src={brain}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
          animate={{ opacity: [0.85, 1, 0.85], scale: [0.985, 1.01, 0.985] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            filter: `drop-shadow(0 0 32px ${t.glowRgba}) drop-shadow(0 0 16px rgba(255,229,180,0.10))`,
          }}
        />

        {/* Lobe markers — pulse when their chamber is part of the active committee */}
        {ALL_CHAMBERS.map((cid) => {
          const ct = CHAMBER_THEME[cid];
          const dot = LOBE_DOTS[cid];
          const isActive = activeChambers.includes(cid);
          const isHome = cid === chamberId;
          return (
            <motion.div
              key={cid}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: isHome ? 28 : 18,
                height: isHome ? 28 : 18,
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
                delay: isHome ? 0 : 0.3 + ALL_CHAMBERS.indexOf(cid) * 0.18,
              }}
            />
          );
        })}

        {/* Forge ember — always pulses faster + warmer */}
        <motion.div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${LOBE_DOTS.forge.x}%`,
            top: `${LOBE_DOTS.forge.y}%`,
            width: chamberId === "forge" ? 60 : 30,
            height: chamberId === "forge" ? 60 : 30,
            background:
              "radial-gradient(circle, #FFE5B4 0%, #C84A1F 40%, rgba(200,74,31,0.45) 65%, transparent 80%)",
            mixBlendMode: "screen",
          }}
          animate={{
            opacity: [0.65, 1, 0.65],
            scale: [0.9, 1.1, 0.9],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Status line */}
      <div className="mt-8 text-center" data-testid="deliberation-status">
        <p
          className="smallcaps"
          style={{ color: t.accent, opacity: 0.9 }}
        >
          {phase === "convening" && "Convening"}
          {phase === "chamber" && `${t.name} in session`}
          {phase === "committee" && "Committee in session"}
          {phase === "synthesis" && "Verdict taking shape"}
        </p>
        <motion.p
          key={`${phase}-${msgIdx}`}
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
    </div>
  );
}

// CortexHero — uses the user-provided lateral brain image as the hero,
// with absolutely-positioned interactive lobe hotspots over the cortex.
//
// Image is left-lateral (side view): cerebellum at bottom-right, brainstem trailing down.
//   Frontal lobe (Senate) ......... front-top, left of center
//   Parietal lobe (Boardroom) ..... top-back / crown
//   Temporal lobe (Court Room) .... lower bulge, mid
//   Occipital lobe (Council) ...... back of brain, right
//   Corpus Callosum (Forge) ....... bright center, between hemispheres
//
// All coordinates are PERCENTAGES of the square image box.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";

// hot.x/hot.y = hotspot center. lab.x/lab.y = label center. Both as % of box.
const REGIONS = [
  {
    id: "senate",
    label: "Senate",
    biology: "Frontal Lobe",
    hot: { x: 30, y: 38, r: 11 },
    lab: { x: 16, y: 22 },
    align: "right",
  },
  {
    id: "boardroom",
    label: "Boardroom",
    biology: "Parietal Lobe",
    hot: { x: 56, y: 22, r: 11 },
    lab: { x: 56, y: 7 },
    align: "center",
  },
  {
    id: "courtroom",
    label: "Court Room",
    biology: "Temporal Lobe",
    hot: { x: 40, y: 64, r: 10 },
    lab: { x: 22, y: 80 },
    align: "right",
  },
  {
    id: "council",
    label: "Council",
    biology: "Occipital Lobe",
    hot: { x: 80, y: 50, r: 11 },
    lab: { x: 94, y: 50 },
    align: "left",
  },
];

const FORGE = { x: 53, y: 44, r: 6, lab: { x: 53, y: 70 } };

export default function CortexHero({ className = "" }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const brain = getImage("brain_hero");

  const onClick = (id) => {
    if (id === "forge") navigate("/forge");
    else navigate(`/chamber/${id}`);
  };

  return (
    <div
      className={`relative mx-auto w-full max-w-[640px] aspect-square ${className}`}
      data-testid="cortex-hero"
    >
      {/* Outer aureole */}
      <div
        className="pointer-events-none absolute inset-[-15%]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(201,169,97,0.10), rgba(200,74,31,0.06) 28%, transparent 60%)",
        }}
      />

      {/* Brain image */}
      <motion.img
        data-img="brain_hero"
        src={brain}
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

      {/* Subtle breathing veil */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,229,180,0.05), transparent 55%)",
        }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Hotspots (interactive circles) */}
      {REGIONS.map((r) => {
        const t = CHAMBER_THEME[r.id];
        const isHover = hovered === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onClick(r.id)}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(r.id)}
            onBlur={() => setHovered(null)}
            data-testid={`lobe-${r.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
            style={{
              left: `${r.hot.x}%`,
              top: `${r.hot.y}%`,
              width: `${r.hot.r * 2}%`,
              height: `${r.hot.r * 2}%`,
              borderRadius: "50%",
              background: isHover
                ? `radial-gradient(circle, ${t.primary}66 0%, ${t.primary}22 40%, transparent 72%)`
                : `radial-gradient(circle, ${t.primary}1A 0%, transparent 70%)`,
              boxShadow: isHover ? `0 0 50px 10px ${t.glowRgba}` : "none",
              transition: "background 0.4s ease, box-shadow 0.4s ease",
            }}
          >
            <span
              aria-hidden
              className="absolute inset-[16%] rounded-full border transition-all duration-500"
              style={{
                borderColor: isHover ? t.accent + "BB" : "transparent",
                boxShadow: isHover ? `inset 0 0 22px ${t.glowRgba}` : "none",
              }}
            />
          </button>
        );
      })}

      {/* Labels (separate layer so positioning is predictable) */}
      {REGIONS.map((r) => {
        const t = CHAMBER_THEME[r.id];
        const isHover = hovered === r.id;
        const align =
          r.align === "left"
            ? "items-start text-left"
            : r.align === "right"
            ? "items-end text-right"
            : "items-center text-center";
        const translate =
          r.align === "left"
            ? "translate(0, -50%)"
            : r.align === "right"
            ? "translate(-100%, -50%)"
            : "translate(-50%, -50%)";
        return (
          <div
            key={`label-${r.id}`}
            className={`pointer-events-none absolute flex flex-col whitespace-nowrap ${align}`}
            style={{
              left: `${r.lab.x}%`,
              top: `${r.lab.y}%`,
              transform: translate,
              transition: "opacity 0.35s ease, transform 0.35s ease",
              opacity: isHover ? 1 : 0.78,
            }}
          >
            <span
              className="cortex-display italic"
              style={{
                fontSize: isHover ? "1.5rem" : "1.25rem",
                color: isHover ? "#F5F2EC" : t.accent,
                textShadow:
                  "0 1px 10px rgba(10,10,15,0.95), 0 0 18px rgba(10,10,15,0.85)",
                fontWeight: 600,
                lineHeight: 1.1,
                transition: "all 0.35s ease",
              }}
            >
              {r.label}
            </span>
            <span
              className="smallcaps mt-0.5"
              style={{
                color: "#E8E4DC",
                opacity: isHover ? 0.95 : 0.55,
                textShadow: "0 1px 6px rgba(10,10,15,0.95)",
              }}
            >
              {r.biology}
            </span>
            <span
              className="cortex-editorial italic mt-1"
              style={{
                fontSize: "0.78rem",
                color: t.accent,
                opacity: isHover ? 0.95 : 0.65,
                textShadow: "0 1px 6px rgba(10,10,15,0.95)",
                letterSpacing: "0.01em",
              }}
            >
              {t.description}
            </span>
          </div>
        );
      })}

      {/* The Forge — central glowing orb */}
      <button
        type="button"
        onClick={() => onClick("forge")}
        onMouseEnter={() => setHovered("forge")}
        onMouseLeave={() => setHovered(null)}
        data-testid="lobe-forge"
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
        style={{
          left: `${FORGE.x}%`,
          top: `${FORGE.y}%`,
          width: `${FORGE.r * 2}%`,
          height: `${FORGE.r * 2}%`,
          borderRadius: "50%",
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
            scale: hovered === "forge" ? [1, 1.12, 1] : [0.9, 1.06, 0.9],
            opacity: hovered === "forge" ? 1 : [0.78, 1, 0.78],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </button>

      {/* Forge label */}
      <div
        className="pointer-events-none absolute flex flex-col items-center text-center"
        style={{
          left: `${FORGE.lab.x}%`,
          top: `${FORGE.lab.y}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <span
          className="cortex-display italic"
          style={{
            color: "#FFE5B4",
            fontWeight: 700,
            fontSize: hovered === "forge" ? "1.55rem" : "1.35rem",
            textShadow:
              "0 0 16px rgba(200,74,31,0.85), 0 1px 10px rgba(10,10,15,0.95)",
            transition: "font-size 0.35s ease",
            lineHeight: 1.05,
          }}
        >
          The Forge
        </span>
        <span
          className="smallcaps mt-0.5"
          style={{
            color: "#FFE5B4",
            opacity: 0.8,
            textShadow: "0 1px 6px rgba(10,10,15,0.95)",
          }}
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

      {/* Hover caption beneath */}
      <div
        className="absolute -bottom-12 left-0 right-0 text-center smallcaps text-ash transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0.45 }}
        data-testid="cortex-hover-caption"
      >
        {hovered
          ? `${CHAMBER_THEME[hovered].name} — ${CHAMBER_THEME[hovered].description}`
          : "Hover a region. Click to descend."}
      </div>
    </div>
  );
}

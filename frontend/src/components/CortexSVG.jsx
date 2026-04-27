// CortexSVG — anatomical brain (top-down view) with 4 lobes + corpus callosum.
// Each lobe is interactive and breathes in its chamber color.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CHAMBER_THEME } from "@/lib/chambers";

// Hand-crafted SVG paths approximating a top-down cerebrum.
// Coordinate space: 0..1000 wide, 0..760 tall.
// Two hemispheres meet at x=500. Lobes split along anatomical lines.

const LOBES = {
  // FRONTAL LOBE (top of brain, both hemispheres) — Senate
  senate: {
    label: "Senate",
    biology: "Frontal Lobe",
    path: `
      M 500 60
      C 420 60, 320 78, 240 130
      C 165 180, 130 250, 130 320
      L 500 320
      Z
      M 500 60
      C 580 60, 680 78, 760 130
      C 835 180, 870 250, 870 320
      L 500 320
      Z
    `,
    centroid: { x: 500, y: 200 },
    hover: { x: 500, y: 200 },
  },
  // PARIETAL LOBE (mid-back of brain) — Boardroom
  boardroom: {
    label: "Boardroom",
    biology: "Parietal Lobe",
    path: `
      M 130 320
      L 500 320
      L 500 470
      L 150 470
      C 135 430, 128 380, 130 320
      Z
      M 870 320
      L 500 320
      L 500 470
      L 850 470
      C 865 430, 872 380, 870 320
      Z
    `,
    centroid: { x: 235, y: 400 },
    hover: { x: 235, y: 400 },
    centroid2: { x: 765, y: 400 },
  },
  // TEMPORAL LOBE (lower sides — wraps under) — Courtroom
  courtroom: {
    label: "Court Room",
    biology: "Temporal Lobe",
    path: `
      M 130 320
      C 130 380, 135 430, 150 470
      L 235 590
      C 270 615, 320 625, 360 615
      L 500 470
      L 130 320 Z
      M 870 320
      C 870 380, 865 430, 850 470
      L 765 590
      C 730 615, 680 625, 640 615
      L 500 470
      L 870 320 Z
    `,
    centroid: { x: 245, y: 555 },
    hover: { x: 245, y: 555 },
    centroid2: { x: 755, y: 555 },
  },
  // OCCIPITAL LOBE (rear) — Council
  council: {
    label: "Council",
    biology: "Occipital Lobe",
    path: `
      M 360 615
      C 410 660, 440 680, 500 690
      C 560 680, 590 660, 640 615
      L 500 470
      Z
    `,
    centroid: { x: 500, y: 615 },
    hover: { x: 500, y: 615 },
  },
};

const FORGE = {
  // Corpus callosum — central seam between hemispheres
  centroid: { x: 500, y: 380 },
};

const SULCI_PATHS = [
  // gentle sulci (folds) suggesting cortical wrinkles
  "M 200 200 q 80 -20 160 0 q 80 20 160 0",
  "M 600 200 q 60 -15 120 0 q 60 15 120 0",
  "M 180 360 q 90 -25 170 0",
  "M 660 360 q 90 25 160 0",
  "M 280 540 q 80 -15 160 0",
  "M 580 540 q 80 15 160 0",
  "M 380 660 q 60 -10 120 0 q 60 10 120 0",
];

const lobeOrder = ["senate", "boardroom", "courtroom", "council"];

export default function CortexSVG({ className = "" }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const handleEnter = (id) => setHovered(id);
  const handleLeave = () => setHovered(null);
  const handleClick = (id) => {
    if (id === "forge") navigate("/forge");
    else navigate(`/chamber/${id}`);
  };

  return (
    <div className={`relative w-full ${className}`} data-testid="cortex-svg">
      <svg
        viewBox="0 0 1000 760"
        className="block w-full h-auto select-none"
        role="img"
        aria-label="The Cerebral Cortex — five chambers"
      >
        {/* Outer aureole / skull glow */}
        <defs>
          <radialGradient id="skullGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#C9A961" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#0A0A0F" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="forgeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE5B4" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#C84A1F" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#C84A1F" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1000" height="760" fill="url(#skullGlow)" />

        {/* Lobes */}
        {lobeOrder.map((id) => {
          const t = CHAMBER_THEME[id];
          const lobe = LOBES[id];
          const isHover = hovered === id;
          return (
            <g
              key={id}
              onMouseEnter={() => handleEnter(id)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(id)}
              style={{ cursor: "pointer" }}
              data-testid={`lobe-${id}`}
            >
              <motion.path
                d={lobe.path}
                fill={t.primary}
                stroke={t.accent}
                strokeWidth={isHover ? 1.8 : 1.0}
                initial={{ opacity: 0.32 }}
                animate={{
                  opacity: isHover ? 0.92 : [0.34, 0.55, 0.34],
                }}
                transition={
                  isHover
                    ? { duration: 0.4 }
                    : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }
                style={{
                  filter: isHover
                    ? `drop-shadow(0 0 22px ${t.glowRgba})`
                    : `drop-shadow(0 0 8px ${t.glowRgba})`,
                  transition: "filter 0.35s ease",
                }}
              />
              {/* Labels at lobe centroid(s) — render in both hemispheres for split lobes */}
              {[lobe.centroid, lobe.centroid2].filter(Boolean).map((c, ci) => (
                <g key={ci} transform={`translate(${c.x}, ${c.y})`} pointerEvents="none">
                  <text
                    textAnchor="middle"
                    fontFamily="Cormorant Garamond, serif"
                    fontStyle="italic"
                    fontSize={isHover ? "28" : "24"}
                    fill={isHover ? "#F5F2EC" : t.accent}
                    style={{ transition: "all 0.35s ease" }}
                  >
                    {lobe.label}
                  </text>
                  <text
                    textAnchor="middle"
                    y="20"
                    fontFamily="DM Sans, sans-serif"
                    fontSize="9"
                    fill="#E8E4DC"
                    opacity={isHover ? 0.85 : 0.45}
                    style={{
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      transition: "opacity 0.35s ease",
                    }}
                  >
                    {lobe.biology}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* Sulci wrinkles, on top of lobes for cortical feel */}
        <g pointerEvents="none" stroke="#0A0A0F" strokeOpacity="0.4" fill="none" strokeWidth="1.2">
          {SULCI_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* Central seam (longitudinal fissure) */}
        <line
          x1="500"
          y1="60"
          x2="500"
          y2="690"
          stroke="#0A0A0F"
          strokeWidth="2"
          opacity="0.6"
          pointerEvents="none"
        />

        {/* THE FORGE — corpus callosum at center */}
        <g
          onMouseEnter={() => handleEnter("forge")}
          onMouseLeave={handleLeave}
          onClick={() => handleClick("forge")}
          style={{ cursor: "pointer" }}
          data-testid="lobe-forge"
        >
          <circle
            cx={FORGE.centroid.x}
            cy={FORGE.centroid.y}
            r="78"
            fill="url(#forgeGlow)"
            filter="url(#softGlow)"
          >
            <animate
              attributeName="r"
              values="68;82;68"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
          <motion.ellipse
            cx={FORGE.centroid.x}
            cy={FORGE.centroid.y}
            rx="44"
            ry="22"
            fill="#FFE5B4"
            initial={{ opacity: 0.7 }}
            animate={{
              opacity: hovered === "forge" ? 1 : [0.7, 1, 0.7],
            }}
            transition={
              hovered === "forge"
                ? { duration: 0.3 }
                : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              filter: "drop-shadow(0 0 24px rgba(200,74,31,0.85))",
            }}
          />
          <text
            x={FORGE.centroid.x}
            y={FORGE.centroid.y + 4}
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
            fontStyle="italic"
            fontSize="22"
            fill="#3A2419"
            fontWeight="700"
            pointerEvents="none"
          >
            The Forge
          </text>
        </g>
      </svg>

      {/* Hover caption */}
      <div
        className="mt-6 h-7 text-center smallcaps text-ash transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0.4 }}
        data-testid="cortex-hover-caption"
      >
        {hovered === "forge"
          ? "The Forge — Corpus Callosum, the integrator"
          : hovered
          ? `${CHAMBER_THEME[hovered].name} — ${CHAMBER_THEME[hovered].biology}`
          : "Hover a lobe. Click to descend."}
      </div>
    </div>
  );
}

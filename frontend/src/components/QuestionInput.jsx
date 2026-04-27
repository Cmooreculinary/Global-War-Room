import React from "react";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";

export default function QuestionInput({
  chamberId,
  value,
  onChange,
  placeholder,
  disabled = false,
}) {
  const t = CHAMBER_THEME[chamberId];
  const parchment = getImage("texture_parchment");

  return (
    <div className="relative" data-testid="question-input-wrap">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${parchment})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.07,
          mixBlendMode: "soft-light",
          pointerEvents: "none",
          borderRadius: 2,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,28,0.65), rgba(10,10,15,0.85))",
          pointerEvents: "none",
          borderRadius: 2,
        }}
      />
      <textarea
        data-testid="question-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        className="relative z-10 block w-full resize-none border bg-transparent px-7 py-6 text-bone placeholder:text-ash focus:outline-none cortex-editorial text-[1.05rem] leading-relaxed"
        style={{
          borderColor: t.accent + "55",
          borderRadius: 2,
          minHeight: 168,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px ${t.accent}10`,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = t.accent;
          e.target.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px ${t.accent}, 0 0 28px ${t.glowRgba}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = t.accent + "55";
          e.target.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px ${t.accent}10`;
        }}
      />
    </div>
  );
}

// A commander and the two consuls he would actually seat.
//
// `chosen_because` is shown deliberately: the interesting claim is not that
// these men were competent, it is that this particular leader would pick them.
import React, { useState } from "react";

import { Glyph } from "./Glyphs";

const ACCENT = "#D6C08A";

export default function TeamRoster({ team, compact = false, selectable = false, selected = false, onToggle }) {
  const [open, setOpen] = useState(false);
  const leader = team.leader;

  return (
    <div
      className="border transition-colors duration-300"
      style={{
        borderColor: selected ? ACCENT : "#2A2A36",
        background: selected ? "rgba(30,42,51,0.55)" : "rgba(20,20,28,0.5)",
        borderRadius: 3,
      }}
      data-testid={`team-${team.id}`}
    >
      <button
        type="button"
        onClick={() => (selectable ? onToggle?.(team.id) : setOpen((o) => !o))}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <span style={{ color: ACCENT }} className="mt-0.5 shrink-0">
          <Glyph name={leader.glyph} size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="cortex-display text-[1.05rem] text-pearl" style={{ fontWeight: 600 }}>
              {leader.name}
            </span>
            <span className="smallcaps tabular text-ash" style={{ fontSize: "0.62rem" }}>
              {leader.dates}
            </span>
          </span>
          <span className="smallcaps block" style={{ color: ACCENT, opacity: 0.85 }}>
            {leader.lineage}
          </span>
          <span className="cortex-editorial mt-1 block text-xs text-bone/55">
            with {team.consuls.map((c) => c.name).join(" and ")}
          </span>
        </span>
        {selectable ? (
          <span
            className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center border"
            style={{ borderColor: selected ? ACCENT : "#3A3A46", background: selected ? ACCENT : "transparent", borderRadius: 1 }}
          >
            {selected && <span className="text-[10px] leading-none" style={{ color: "#14141C" }}>✓</span>}
          </span>
        ) : (
          <span className="smallcaps mt-1 shrink-0 text-ash">{open ? "−" : "+"}</span>
        )}
      </button>

      {!selectable && open && (
        <div className="border-t px-5 py-4" style={{ borderColor: "#2A2A36" }}>
          {!compact && (
            <p className="cortex-editorial text-sm leading-relaxed text-bone/75">{leader.voice_notes}</p>
          )}
          <CharacterSheet profile={leader.profile} />
          <p className="smallcaps mt-4" style={{ color: ACCENT }}>
            His consuls
          </p>
          <ul className="mt-3 space-y-4">
            {team.consuls.map((consul) => (
              <li key={consul.id} className="flex gap-3">
                <span className="mt-0.5 shrink-0" style={{ color: ACCENT, opacity: 0.8 }}>
                  <Glyph name={consul.glyph} size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="cortex-display text-[0.97rem] text-pearl" style={{ fontWeight: 600 }}>
                      {consul.name}
                    </span>
                    <span className="smallcaps tabular text-ash" style={{ fontSize: "0.6rem" }}>
                      {consul.dates}
                    </span>
                  </div>
                  <p className="smallcaps" style={{ color: ACCENT, opacity: 0.75 }}>
                    {consul.lineage}
                  </p>
                  <p className="cortex-editorial mt-1.5 text-sm italic leading-relaxed text-bone/65">
                    {consul.chosen_because}
                  </p>
                  {!compact && (
                    <p className="cortex-editorial mt-1.5 text-sm leading-relaxed text-bone/75">
                      {consul.voice_notes}
                    </p>
                  )}
                  <CharacterSheet profile={consul.profile} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The character sheet — what actually separates one commander from another.
 * The failure modes are shown as prominently as the rules on purpose: they are
 * the reason five men give five different answers instead of one.
 */
export function CharacterSheet({ profile }) {
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  const rules = profile.heuristics || [];
  const flaws = profile.blind_spots || [];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="smallcaps text-ash transition-colors hover:text-bone"
        data-testid="toggle-character-sheet"
      >
        {open ? "− Character" : "+ Character"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-l pl-4" style={{ borderColor: "#2A2A36" }}>
          {profile.formation && <Line label="Formation" value={profile.formation} />}
          {profile.temperament && <Line label="Temperament" value={profile.temperament} />}
          {profile.reads_first && <Line label="Notices first" value={profile.reads_first} tone={ACCENT} />}

          {rules.length > 0 && (
            <div>
              <p className="smallcaps" style={{ color: ACCENT }}>
                How he decides
              </p>
              <ul className="mt-1 space-y-1">
                {rules.map((rule, i) => (
                  <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/80">
                    — {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.signature_move && <Line label="Signature" value={profile.signature_move} />}

          {flaws.length > 0 && (
            <div>
              <p className="smallcaps" style={{ color: "#D08C7A" }}>
                How he fails
              </p>
              <ul className="mt-1 space-y-1">
                {flaws.map((flaw, i) => (
                  <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/80">
                    — {flaw}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.breaking_point && <Line label="What stopped him" value={profile.breaking_point} />}
          {profile.updates_when && <Line label="Changes his mind" value={profile.updates_when} />}
          {profile.tell && <Line label="Tell" value={profile.tell} tone={ACCENT} />}

          {profile.hard_truth && (
            <div
              className="border p-3"
              style={{ borderColor: "#D08C7A44", background: "rgba(208,140,122,0.06)", borderRadius: 2 }}
            >
              <p className="smallcaps" style={{ color: "#D08C7A" }}>
                Not sanitised
              </p>
              <p className="cortex-editorial mt-1 text-sm leading-relaxed text-bone/85">
                {profile.hard_truth}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Line({ label, value, tone }) {
  return (
    <div>
      <p className="smallcaps" style={{ color: tone || "#6B6B78" }}>
        {label}
      </p>
      <p className="cortex-editorial mt-0.5 text-sm leading-relaxed text-bone/80">{value}</p>
    </div>
  );
}

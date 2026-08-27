// Five teams, five futures, read against each other.
import React, { useState } from "react";
import { motion } from "framer-motion";

const ACCENT = "#D6C08A";

const ODDS_TONE = { likely: "#D08C7A", possible: "#D6C08A", unlikely: "#9FB5C4" };

export default function ProjectionView({ projections = [], comparison, horizon = 5 }) {
  const [active, setActive] = useState(0);
  if (!projections.length) return null;
  const current = projections[Math.min(active, projections.length - 1)];

  return (
    <div data-testid="projection-view">
      {/* Team switcher */}
      <div className="flex flex-wrap gap-2">
        {projections.map((p, i) => (
          <button
            key={p.team}
            onClick={() => setActive(i)}
            className="cortex-ui border px-4 py-2 text-sm transition-colors"
            style={{
              borderColor: i === active ? ACCENT : "#2A2A36",
              color: i === active ? ACCENT : "#E8E4DC",
              background: i === active ? "rgba(214,192,138,0.10)" : "transparent",
              borderRadius: 2,
            }}
            data-testid={`projection-tab-${p.team}`}
          >
            {p.leader}
          </button>
        ))}
      </div>

      <motion.article
        key={current.team}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-6 border p-6 md:p-8"
        style={{ borderColor: `${ACCENT}44`, background: "rgba(30,42,51,0.35)", borderRadius: 3 }}
      >
        <p className="smallcaps" style={{ color: ACCENT }}>
          {current.leader}'s projection — {horizon} years
        </p>
        <p className="cortex-editorial mt-3 text-lg leading-relaxed text-pearl">{current.trajectory}</p>

        {/* Year timeline */}
        <ol className="mt-8 space-y-0">
          {current.phases.map((phase, i) => (
            <li key={i} className="relative flex gap-5 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center border text-xs tabular"
                  style={{ borderColor: `${ACCENT}66`, color: ACCENT, borderRadius: 1 }}
                >
                  {i + 1}
                </span>
                {i < current.phases.length - 1 && (
                  <span className="mt-1 w-px flex-1" style={{ background: "#2A2A36" }} />
                )}
              </div>
              <div className="min-w-0 pb-2">
                <p className="smallcaps" style={{ color: ACCENT, opacity: 0.8 }}>
                  {phase.window}
                </p>
                <p className="cortex-editorial mt-1 text-[0.97rem] leading-relaxed text-bone">{phase.expect}</p>
                {phase.why && (
                  <p className="cortex-editorial mt-1 text-sm italic leading-relaxed text-bone/55">{phase.why}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 border-t pt-6 md:grid-cols-2" style={{ borderColor: "#2A2A36" }}>
          <div>
            <p className="smallcaps text-ash">Flashpoints</p>
            <ul className="mt-2 space-y-2">
              {current.flashpoints.map((f, i) => (
                <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                  <span style={{ color: ODDS_TONE[f.odds] || ACCENT }}>{f.where}</span> — {f.trigger}{" "}
                  <span className="smallcaps" style={{ color: ODDS_TONE[f.odds] || ACCENT }}>
                    [{f.odds}]
                  </span>
                </li>
              ))}
              {!current.flashpoints.length && <Empty>None named.</Empty>}
            </ul>
          </div>
          <div>
            <p className="smallcaps text-ash">Wildcards</p>
            <ul className="mt-2 space-y-2">
              {current.wildcards.map((w, i) => (
                <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                  — {w}
                </li>
              ))}
              {!current.wildcards.length && <Empty>None named.</Empty>}
            </ul>
          </div>
        </div>

        {current.internal_dissent?.length > 0 && (
          <div className="mt-6 border-t pt-6" style={{ borderColor: "#2A2A36" }}>
            <p className="smallcaps" style={{ color: "#D08C7A" }}>
              Dissent inside the team
            </p>
            <ul className="mt-2 space-y-2">
              {current.internal_dissent.map((d, i) => (
                <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                  <span className="smallcaps" style={{ color: "#D08C7A" }}>
                    {d.who}:
                  </span>{" "}
                  {d.objection}
                </li>
              ))}
            </ul>
          </div>
        )}

        {current.signature && (
          <p className="cortex-editorial mt-6 border-t pt-4 text-sm italic text-bone/70" style={{ borderColor: "#2A2A36" }}>
            {current.signature}
          </p>
        )}
      </motion.article>

      {/* Cross-team read */}
      {comparison && (comparison.consensus || comparison.divergences?.length > 0) && (
        <section className="mt-12" data-testid="projection-comparison">
          <div className="border-b pb-2" style={{ borderColor: "#2A2A36" }}>
            <h4 className="smallcaps" style={{ color: ACCENT }}>
              Read against each other
            </h4>
          </div>

          {comparison.consensus && (
            <div className="mt-5">
              <p className="smallcaps text-ash">Where they converge</p>
              <p className="cortex-editorial mt-1.5 text-[1.02rem] leading-relaxed text-pearl">
                {comparison.consensus}
              </p>
            </div>
          )}

          {comparison.divergences?.length > 0 && (
            <div className="mt-6 space-y-5">
              {comparison.divergences.map((d, i) => (
                <div key={i} className="border-l-2 pl-4" style={{ borderColor: "#D08C7A55" }}>
                  <p className="cortex-display text-lg text-pearl" style={{ fontWeight: 600 }}>
                    {d.question}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {d.positions?.map((p, j) => (
                      <li key={j} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                        <span className="smallcaps" style={{ color: ACCENT }}>
                          {p.team}:
                        </span>{" "}
                        {p.holds}
                      </li>
                    ))}
                  </ul>
                  {d.root && (
                    <p className="cortex-editorial mt-2 text-sm italic text-bone/60">{d.root}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {comparison.lone_signals?.length > 0 && (
            <div className="mt-6">
              <p className="smallcaps text-ash">Seen by one team only</p>
              <ul className="mt-2 space-y-2">
                {comparison.lone_signals.map((s, i) => (
                  <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                    <span className="smallcaps" style={{ color: ACCENT }}>
                      {s.team}:
                    </span>{" "}
                    {s.saw}{" "}
                    <span className="italic text-bone/55">{s.worth_taking_seriously_because}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid gap-5 border-t pt-6 md:grid-cols-2" style={{ borderColor: "#2A2A36" }}>
            {comparison.hinge_question && (
              <div>
                <p className="smallcaps text-ash">The hinge</p>
                <p className="cortex-editorial mt-1.5 text-sm leading-relaxed text-bone/85">
                  {comparison.hinge_question}
                </p>
              </div>
            )}
            {comparison.if_you_watch_one_thing && (
              <div>
                <p className="smallcaps" style={{ color: ACCENT }}>
                  Watch one thing
                </p>
                <p className="cortex-editorial mt-1.5 text-sm leading-relaxed text-bone/85">
                  {comparison.if_you_watch_one_thing}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Empty({ children }) {
  return <li className="cortex-editorial text-sm italic text-ash">{children}</li>;
}

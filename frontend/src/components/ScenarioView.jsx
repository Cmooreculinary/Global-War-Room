// A scenario as it plays: opening postures, then a year at a time, then the debrief.
//
// Years stream in while the run is still going, so this renders partial state
// on purpose — the point is watching it unfold.
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT = "#D6C08A";

const ESCALATION_TONE = {
  easing: "#9FC4A8",
  steady: "#9FB5C4",
  rising: "#D6C08A",
  acute: "#D08C7A",
  "open conflict": "#C0564A",
};

const RESULT_TONE = { achieved: "#9FC4A8", partial: "#D6C08A", missed: "#D08C7A" };
const VERDICT_TONE = { vindicated: "#9FC4A8", mixed: "#D6C08A", refuted: "#D08C7A" };

export default function ScenarioView({ run }) {
  const { opening = [], years = [], debrief, horizon = 5, status } = run || {};
  if (!opening.length && !years.length) return null;

  return (
    <div data-testid="scenario-view">
      {/* Turn zero */}
      {opening.length > 0 && (
        <section>
          <div className="border-b pb-2" style={{ borderColor: "#2A2A36" }}>
            <h4 className="smallcaps" style={{ color: ACCENT }}>
              Turn zero — what each council is trying to do
            </h4>
          </div>
          <div className={`mt-5 grid gap-5 ${opening.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {opening.map((actor) => (
              <div
                key={actor.actor}
                className="border p-5"
                style={{ borderColor: `${ACCENT}44`, background: "rgba(30,42,51,0.35)", borderRadius: 3 }}
                data-testid={`opening-${actor.actor}`}
              >
                <h5 className="cortex-display text-2xl text-pearl" style={{ fontWeight: 700 }}>
                  {actor.actor}
                </h5>
                <p className="cortex-editorial mt-2 text-[0.97rem] leading-relaxed text-bone">{actor.doctrine}</p>

                <Labelled label="Objectives">
                  <ol className="space-y-1">
                    {actor.objectives?.map((o, i) => (
                      <li key={i} className="cortex-editorial flex gap-2 text-sm text-bone/85">
                        <span className="tabular text-xs" style={{ color: ACCENT }}>
                          {i + 1}
                        </span>
                        {o}
                      </li>
                    ))}
                  </ol>
                </Labelled>

                <Labelled label="Red lines" tone="#D08C7A">
                  <ul className="space-y-1">
                    {actor.red_lines?.map((r, i) => (
                      <li key={i} className="cortex-editorial text-sm text-bone/85">
                        — {r}
                      </li>
                    ))}
                  </ul>
                </Labelled>

                {actor.council_split && (
                  <Labelled label="The council is split">
                    <p className="cortex-editorial text-sm italic leading-relaxed text-bone/75">
                      {actor.council_split}
                    </p>
                  </Labelled>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The years */}
      {years.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: "#2A2A36" }}>
            <h4 className="smallcaps" style={{ color: ACCENT }}>
              As played
            </h4>
            <span className="tabular text-xs text-ash">
              {years.length} of {horizon}
            </span>
          </div>

          <div className="mt-6 space-y-6">
            <AnimatePresence initial={false}>
              {years.map((year) => (
                <motion.article
                  key={year.year}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="border p-6"
                  style={{ borderColor: "#2A2A36", background: "rgba(20,20,28,0.6)", borderRadius: 3 }}
                  data-testid={`year-${year.year}`}
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-3">
                    <h5 className="cortex-display text-xl text-pearl" style={{ fontWeight: 600 }}>
                      Year {year.year}
                    </h5>
                    <span
                      className="smallcaps border px-2 py-0.5"
                      style={{
                        color: ESCALATION_TONE[year.escalation] || ACCENT,
                        borderColor: `${ESCALATION_TONE[year.escalation] || ACCENT}55`,
                        borderRadius: 2,
                        fontSize: "0.66rem",
                      }}
                    >
                      {year.escalation}
                    </span>
                  </header>

                  {year.moves?.length > 0 && (
                    <ul className="mt-4 space-y-4">
                      {year.moves.map((move, i) => (
                        <li key={i} className="border-l-2 pl-4" style={{ borderColor: `${ACCENT}44` }}>
                          <p className="smallcaps" style={{ color: ACCENT }}>
                            {move.actor}
                          </p>
                          <p className="cortex-editorial mt-0.5 text-[0.97rem] leading-relaxed text-bone">
                            {move.move}
                          </p>
                          {move.rationale && (
                            <p className="cortex-editorial mt-1 text-sm text-bone/60">{move.rationale}</p>
                          )}
                          <p className="smallcaps mt-1.5 text-ash">
                            pushed by {move.pushed_by || "—"}
                            {move.opposed_by && move.opposed_by.toLowerCase() !== "unopposed" && (
                              <> · opposed by {move.opposed_by}</>
                            )}
                          </p>
                          {move.cost && (
                            <p className="smallcaps mt-0.5" style={{ color: "#D08C7A" }}>
                              cost: <span className="cortex-editorial text-sm text-bone/70">{move.cost}</span>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {year.friction && (
                    <div
                      className="mt-5 border p-4"
                      style={{ borderColor: "#D08C7A44", background: "rgba(208,140,122,0.06)", borderRadius: 2 }}
                    >
                      <p className="smallcaps" style={{ color: "#D08C7A" }}>
                        Nobody planned this
                      </p>
                      <p className="cortex-editorial mt-1 text-sm leading-relaxed text-bone/85">{year.friction}</p>
                    </div>
                  )}

                  {year.interaction && (
                    <p className="cortex-editorial mt-5 text-[0.97rem] leading-relaxed text-bone/90">
                      {year.interaction}
                    </p>
                  )}
                  {year.world_state && (
                    <p className="cortex-editorial mt-3 text-sm italic leading-relaxed text-bone/65">
                      {year.world_state}
                    </p>
                  )}

                  {year.scorecard?.length > 0 && (
                    <div className="mt-5 overflow-x-auto border-t pt-4" style={{ borderColor: "#2A2A36" }}>
                      <table className="w-full min-w-[520px] border-collapse text-left">
                        <thead>
                          <tr className="smallcaps text-ash">
                            <th className="py-1 pr-4 font-normal">Actor</th>
                            <th className="py-1 pr-4 font-normal">Gained</th>
                            <th className="py-1 font-normal">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {year.scorecard.map((s, i) => (
                            <tr key={i} className="align-top">
                              <td className="py-1.5 pr-4">
                                <span className="smallcaps" style={{ color: ACCENT }}>
                                  {s.actor}
                                </span>
                              </td>
                              <td className="cortex-editorial py-1.5 pr-4 text-sm text-bone/85">{s.gained}</td>
                              <td className="cortex-editorial py-1.5 text-sm text-bone/70">{s.lost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Debrief */}
      {debrief?.outcome && (
        <section className="mt-14" data-testid="scenario-debrief">
          <div
            className="border p-6 md:p-8"
            style={{ borderColor: `${ACCENT}55`, background: "rgba(30,42,51,0.45)", borderRadius: 3 }}
          >
            <p className="smallcaps" style={{ color: ACCENT }}>
              Debrief
            </p>
            <p className="cortex-editorial mt-3 text-lg leading-relaxed text-pearl">{debrief.outcome}</p>

            {debrief.turning_point && (
              <div className="mt-6">
                <p className="smallcaps text-ash">Turning point</p>
                <p className="cortex-editorial mt-1 text-[0.97rem] leading-relaxed text-bone/90">
                  {debrief.turning_point}
                </p>
              </div>
            )}

            {debrief.objectives_scored?.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <p className="smallcaps text-ash">Objectives, scored against turn zero</p>
                <table className="mt-2 w-full min-w-[560px] border-collapse text-left">
                  <tbody>
                    {debrief.objectives_scored.map((o, i) => (
                      <tr key={i} className="align-top">
                        <td className="border-b py-2 pr-4" style={{ borderColor: "#2A2A3688" }}>
                          <span className="smallcaps" style={{ color: ACCENT }}>
                            {o.actor}
                          </span>
                        </td>
                        <td className="cortex-editorial border-b py-2 pr-4 text-sm text-bone/85" style={{ borderColor: "#2A2A3688" }}>
                          {o.objective}
                        </td>
                        <td className="border-b py-2 pr-4" style={{ borderColor: "#2A2A3688" }}>
                          <span className="smallcaps" style={{ color: RESULT_TONE[o.result] || ACCENT }}>
                            {o.result}
                          </span>
                        </td>
                        <td className="cortex-editorial border-b py-2 text-sm text-bone/60" style={{ borderColor: "#2A2A3688" }}>
                          {o.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {debrief.doctrine_held?.length > 0 && (
              <div className="mt-6">
                <p className="smallcaps text-ash">Whose doctrine held</p>
                <ul className="mt-2 space-y-2">
                  {debrief.doctrine_held.map((d, i) => (
                    <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                      <span className="smallcaps" style={{ color: VERDICT_TONE[d.verdict] || ACCENT }}>
                        {d.team} — {d.verdict}:
                      </span>{" "}
                      {d.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.cost_ledger?.length > 0 && (
              <div className="mt-6">
                <p className="smallcaps" style={{ color: "#D08C7A" }}>
                  What it cost, and to whom
                </p>
                <ul className="mt-2 space-y-1">
                  {debrief.cost_ledger.map((c, i) => (
                    <li key={i} className="cortex-editorial text-sm leading-relaxed text-bone/85">
                      <span className="smallcaps text-bone/70">{c.who}:</span> {c.paid}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.transferable_lesson && (
              <div className="mt-8 border-t pt-6" style={{ borderColor: "#2A2A36" }}>
                <p className="smallcaps" style={{ color: ACCENT }}>
                  What to take from it
                </p>
                <p className="cortex-editorial mt-1.5 text-[1.02rem] leading-relaxed text-pearl">
                  {debrief.transferable_lesson}
                </p>
              </div>
            )}

            {debrief.load_bearing_assumption && (
              <p className="cortex-editorial mt-5 text-sm italic leading-relaxed text-ash">
                This rests on one assumption: {debrief.load_bearing_assumption} If that is wrong, none of the
                above holds.
              </p>
            )}
          </div>
        </section>
      )}

      {status === "running" && (
        <p className="smallcaps mt-8 text-center text-ash" data-testid="scenario-still-running">
          Still playing…
        </p>
      )}
    </div>
  );
}

function Labelled({ label, tone, children }) {
  return (
    <div className="mt-4">
      <p className="smallcaps" style={{ color: tone || "#6B6B78" }}>
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

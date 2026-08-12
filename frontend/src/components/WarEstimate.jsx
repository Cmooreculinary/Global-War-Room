// The estimate — what a decision-maker takes away once five commanders have
// disagreed in front of them.
import React from "react";

const ACCENT = "#D6C08A";

const CONFIDENCE_TONE = {
  high: "#9FC4A8",
  moderate: "#D6C08A",
  low: "#D08C7A",
};

export default function WarEstimate({ estimate }) {
  if (!estimate) return null;
  const tone = CONFIDENCE_TONE[estimate.confidence] || CONFIDENCE_TONE.moderate;
  const indicators = estimate.indicators || [];

  return (
    <div data-testid="war-estimate">
      <div
        className="border p-6 md:p-8"
        style={{ borderColor: `${ACCENT}55`, background: "rgba(30,42,51,0.45)", borderRadius: 3 }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="smallcaps" style={{ color: ACCENT }}>
            The estimate
          </p>
          <span className="smallcaps" style={{ color: tone }}>
            {estimate.confidence || "moderate"} confidence
          </span>
        </div>

        <Block label="Where they converge" value={estimate.convergence} lead />
        <Block label="Where they split" value={estimate.fault_line} tone="#D08C7A" />
        <Block label="The decision" value={estimate.decision_point} />

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Course label="Most likely" value={estimate.most_likely_course} tone="#9FB5C4" />
          <Course label="Most dangerous" value={estimate.most_dangerous_course} tone="#D08C7A" />
        </div>

        {estimate.confidence_note && (
          <p className="cortex-editorial mt-6 border-t pt-4 text-sm italic text-ash" style={{ borderColor: "#2A2A36" }}>
            {estimate.confidence_note}
          </p>
        )}
      </div>

      {indicators.length > 0 && (
        <section className="mt-8" data-testid="estimate-indicators">
          <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: "#2A2A36" }}>
            <h4 className="smallcaps" style={{ color: ACCENT }}>
              What to watch
            </h4>
            <span className="tabular text-xs text-ash">{indicators.length}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="smallcaps text-ash">
                  <th className="border-b py-2 pr-4 font-normal" style={{ borderColor: "#2A2A36" }}>
                    If you see
                  </th>
                  <th className="border-b py-2 pr-4 font-normal" style={{ borderColor: "#2A2A36" }}>
                    It means
                  </th>
                  <th className="border-b py-2 font-normal" style={{ borderColor: "#2A2A36" }}>
                    Confirms
                  </th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b py-3 pr-4" style={{ borderColor: "#2A2A3688" }}>
                      <span className="cortex-editorial text-sm text-bone">{ind.watch_for}</span>
                    </td>
                    <td className="border-b py-3 pr-4" style={{ borderColor: "#2A2A3688" }}>
                      <span className="cortex-editorial text-sm text-bone/75">{ind.means}</span>
                    </td>
                    <td className="border-b py-3" style={{ borderColor: "#2A2A3688" }}>
                      <span className="smallcaps" style={{ color: ACCENT }}>
                        {ind.confirms}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Block({ label, value, tone, lead = false }) {
  if (!value) return null;
  return (
    <div className="mt-6">
      <p className="smallcaps" style={{ color: tone || "#6B6B78" }}>
        {label}
      </p>
      <p
        className={`cortex-editorial mt-1.5 leading-relaxed ${lead ? "text-lg text-pearl" : "text-[0.97rem] text-bone/90"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Course({ label, value, tone }) {
  if (!value) return null;
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: `${tone}66` }}>
      <p className="smallcaps" style={{ color: tone }}>
        {label}
      </p>
      <p className="cortex-editorial mt-1.5 text-sm leading-relaxed text-bone/85">{value}</p>
    </div>
  );
}

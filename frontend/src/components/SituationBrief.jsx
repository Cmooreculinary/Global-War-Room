// The neutral fact sheet the War Room reasons from.
//
// The point of this component is auditability: the reader should be able to see
// exactly what was treated as established, what was only claimed, what nobody
// knows, and which words were taken out of the coverage on the way here.
import React, { useState } from "react";

const ACCENT = "#D6C08A";

const LEAN_COLOR = {
  wire: "#9FB5C4",
  left: "#7FA3D1",
  "center-left": "#8FB8C9",
  center: "#B9B9B0",
  "center-right": "#CDAE8A",
  right: "#D08C7A",
  international: "#9FC4A8",
  state: "#C98A8A",
  unlabeled: "#6B6B78",
  aggregator: "#A99BC4",
};

export function LeanChip({ lean, count }) {
  const color = LEAN_COLOR[lean] || LEAN_COLOR.unlabeled;
  return (
    <span
      className="smallcaps inline-flex items-center gap-1.5 border px-2 py-0.5"
      style={{ borderColor: `${color}55`, color, borderRadius: 2, fontSize: "0.68rem" }}
    >
      {lean}
      {count != null && <span className="tabular opacity-80">{count}</span>}
    </span>
  );
}

function Section({ label, count, children, tone = ACCENT, testid }) {
  return (
    <section className="mt-8" data-testid={testid}>
      <div className="flex items-baseline gap-3 border-b pb-2" style={{ borderColor: "#2A2A36" }}>
        <h4 className="smallcaps" style={{ color: tone }}>
          {label}
        </h4>
        {count != null && <span className="tabular text-xs text-ash">{count}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p className="cortex-editorial text-sm italic text-ash">{children}</p>;
}

export default function SituationBrief({ brief, sources, items = [] }) {
  const [showSources, setShowSources] = useState(false);
  if (!brief) return null;

  const facts = brief.established_facts || [];
  const contested = brief.contested_claims || [];
  const unknowns = brief.unknowns || [];
  const framing = brief.framing_removed || [];
  const actors = brief.actors || [];
  const timeline = brief.timeline || [];
  const gaps = brief.coverage_gaps || [];
  const spread = sources?.spread || {};
  const notes = sources?.notes || [];

  return (
    <div data-testid="situation-brief">
      {/* Header — the situation as it can be established */}
      <div
        className="border p-6 md:p-8"
        style={{ borderColor: `${ACCENT}44`, background: "rgba(30,42,51,0.35)", borderRadius: 3 }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="smallcaps" style={{ color: ACCENT }}>
            The situation
          </p>
          <span className="smallcaps tabular text-ash">as of {brief.as_of || "unspecified"}</span>
        </div>
        <p className="cortex-editorial mt-3 text-lg leading-relaxed text-pearl">{brief.situation}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: "#2A2A36" }}>
          <span className="smallcaps mr-1 text-ash">
            {sources?.item_count || 0} {sources?.item_count === 1 ? "item" : "items"} ·
          </span>
          {Object.entries(spread).map(([lean, count]) => (
            <LeanChip key={lean} lean={lean} count={count} />
          ))}
          {items.length > 0 && (
            <button
              onClick={() => setShowSources((s) => !s)}
              className="smallcaps ml-auto text-ash transition-colors hover:text-bone"
              data-testid="toggle-sources"
            >
              {showSources ? "Hide sources" : "Show sources"}
            </button>
          )}
        </div>

        {notes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="cortex-editorial text-xs italic text-ash">
                {n}
              </li>
            ))}
          </ul>
        )}

        {showSources && (
          <ul className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "#2A2A36" }} data-testid="source-list">
            {items.map((it, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                <LeanChip lean={it.lean} />
                <span className="smallcaps text-bone/80">{it.outlet}</span>
                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="cortex-editorial text-bone/60 underline decoration-dotted underline-offset-2 transition-colors hover:text-bone"
                  >
                    {it.title}
                  </a>
                ) : (
                  <span className="cortex-editorial text-bone/60">{it.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Established */}
      <Section label="Established" count={facts.length} testid="brief-facts">
        {facts.length === 0 ? (
          <Empty>Nothing in the coverage met the bar for corroboration.</Empty>
        ) : (
          <ul className="space-y-3">
            {facts.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular mt-1 text-xs" style={{ color: ACCENT }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="cortex-editorial text-[0.95rem] leading-relaxed text-bone">{f.fact}</p>
                  <p className="smallcaps mt-1 text-ash">
                    {(f.corroboration || []).join(" · ") || "corroboration unspecified"}
                    {f.confidence ? ` — ${f.confidence} confidence` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Contested */}
      <Section label="Contested — not facts" count={contested.length} tone="#D08C7A" testid="brief-contested">
        {contested.length === 0 ? (
          <Empty>No claim in the coverage was actively disputed.</Empty>
        ) : (
          <ul className="space-y-4">
            {contested.map((c, i) => (
              <li key={i} className="border-l-2 pl-4" style={{ borderColor: "#D08C7A55" }}>
                <p className="cortex-editorial text-[0.95rem] leading-relaxed text-bone">{c.claim}</p>
                <p className="smallcaps mt-1.5 text-ash">
                  asserted by {c.asserted_by || "unknown"} · disputed by {c.disputed_by || "unknown"}
                </p>
                {c.why_contested && (
                  <p className="cortex-editorial mt-1 text-sm text-bone/60">{c.why_contested}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Unknowns */}
      <Section label="Not known" count={unknowns.length} testid="brief-unknowns">
        {unknowns.length === 0 ? (
          <Empty>The sift recorded no outstanding unknowns.</Empty>
        ) : (
          <ul className="space-y-2">
            {unknowns.map((u, i) => (
              <li key={i} className="cortex-editorial flex gap-3 text-[0.95rem] leading-relaxed text-bone/85">
                <span style={{ color: ACCENT }}>—</span>
                <span>{typeof u === "string" ? u : JSON.stringify(u)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* The audit trail — this is the part that earns the word "unbiased" */}
      <Section label="Framing removed" count={framing.length} testid="brief-framing">
        {framing.length === 0 ? (
          <Empty>No loaded language was found to strip.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="smallcaps text-ash">
                  <th className="border-b py-2 pr-4 font-normal" style={{ borderColor: "#2A2A36" }}>
                    As published
                  </th>
                  <th className="border-b py-2 pr-4 font-normal" style={{ borderColor: "#2A2A36" }}>
                    Source
                  </th>
                  <th className="border-b py-2 font-normal" style={{ borderColor: "#2A2A36" }}>
                    As recorded
                  </th>
                </tr>
              </thead>
              <tbody>
                {framing.map((f, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b py-3 pr-4" style={{ borderColor: "#2A2A3688" }}>
                      <span className="cortex-editorial text-sm italic text-bone/55 line-through decoration-1">
                        {f.loaded}
                      </span>
                    </td>
                    <td className="border-b py-3 pr-4" style={{ borderColor: "#2A2A3688" }}>
                      <div className="flex flex-col gap-1">
                        <span className="smallcaps text-bone/70">{f.outlet}</span>
                        {f.lean && <LeanChip lean={f.lean} />}
                      </div>
                    </td>
                    <td className="border-b py-3" style={{ borderColor: "#2A2A3688" }}>
                      <span className="cortex-editorial text-sm text-bone">{f.neutral}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Actors */}
      <Section label="Actors" count={actors.length} testid="brief-actors">
        {actors.length === 0 ? (
          <Empty>No actors were identified in the coverage.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {actors.map((a, i) => (
              <div
                key={i}
                className="border p-4"
                style={{ borderColor: "#2A2A36", borderRadius: 2, background: "rgba(20,20,28,0.6)" }}
              >
                <h5 className="cortex-display text-lg text-pearl" style={{ fontWeight: 600 }}>
                  {a.name}
                </h5>
                <dl className="mt-3 space-y-2">
                  <Field label="Says it wants" value={a.stated_aim} />
                  <Field label="Actions suggest" value={a.inferred_aim} inferred />
                  <Field label="Can bring" value={a.capabilities} />
                  <Field label="Constrained by" value={a.constraints} />
                </dl>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Timeline */}
      {timeline.length > 0 && (
        <Section label="Sequence" count={timeline.length} testid="brief-timeline">
          <ol className="space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="smallcaps w-32 shrink-0 pt-0.5 text-right" style={{ color: ACCENT }}>
                  {t.when}
                </span>
                <span className="cortex-editorial text-[0.95rem] leading-relaxed text-bone/85">{t.what}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Gaps */}
      {gaps.length > 0 && (
        <Section label="Gaps in the coverage" count={gaps.length} testid="brief-gaps">
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={i} className="cortex-editorial flex gap-3 text-sm leading-relaxed text-bone/70">
                <span className="text-ash">—</span>
                <span>{typeof g === "string" ? g : JSON.stringify(g)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Field({ label, value, inferred = false }) {
  if (!value) return null;
  return (
    <div>
      <dt className="smallcaps text-ash">
        {label}
        {inferred && <span style={{ color: "#D08C7A" }}> · inferred</span>}
      </dt>
      <dd className="cortex-editorial mt-0.5 text-sm leading-relaxed text-bone/85">{value}</dd>
    </div>
  );
}

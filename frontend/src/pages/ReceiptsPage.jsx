// Receipts — the public record we reasoned from for each council member.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import Layout from "@/components/Layout";
import { Glyph } from "@/components/Glyphs";
import { CHAMBER_THEME } from "@/lib/chambers";
import { fetchPersonas } from "@/lib/api";

export default function ReceiptsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchPersonas()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError("The receipts could not be retrieved."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // Mount-only effect: imported fetcher is module-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-20" data-testid="receipts-page">
        <p className="smallcaps text-ash">Receipts</p>
        <h2
          className="cortex-display mt-2 text-5xl leading-[0.95] tracking-tight text-pearl md:text-7xl"
          style={{ fontWeight: 700 }}
          data-testid="receipts-title"
        >
          The public record <span className="italic" style={{ color: "#C9A961" }}>we reasoned from.</span>
        </h2>

        {loading && (
          <p className="cortex-display italic text-bone/60 mt-12">Retrieving the ledger…</p>
        )}
        {error && (
          <p className="cortex-editorial mt-12 text-bone/70" data-testid="receipts-error">{error}</p>
        )}

        {data && (
          <>
            {/* Methodology / disclaimer */}
            <div
              className="mt-10 border bg-carbon/85 p-7 md:p-9"
              style={{ borderColor: "#2A2A36", borderRadius: 2, borderLeftWidth: 3, borderLeftColor: "#C9A961" }}
              data-testid="receipts-disclaimer"
            >
              <p className="smallcaps text-ash">Method, plainly stated</p>
              <p className="cortex-editorial mt-3 text-lg leading-relaxed text-bone/90">
                {data.disclaimer}
              </p>
            </div>

            {/* Notation legend */}
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {[
                ["1", "Selection.", "Each council seats world-class voices in the chamber's domain."],
                ["2", "Reconstruction.", "We reason from each figure's published corpus — not from caricature, not from invention."],
                ["3", "Receipts.", "Every voice is listed here with the works we drew from. Adjust where you would."],
              ].map(([num, head, sub]) => (
                <div key={num}>
                  <p
                    className="cortex-display tabular text-3xl"
                    style={{ color: "#C9A961", fontWeight: 600 }}
                  >
                    {num}
                  </p>
                  <p className="cortex-display mt-1 text-lg text-pearl" style={{ fontWeight: 500 }}>
                    {head}
                  </p>
                  <p className="cortex-editorial mt-1 text-sm text-bone/65">{sub}</p>
                </div>
              ))}
            </div>

            <div className="hairline mt-14" />

            {/* Per-chamber receipts */}
            <div className="mt-14 space-y-20" data-testid="receipts-chambers">
              {data.chambers.map((chamber) => (
                <ChamberReceipts key={chamber.id} chamber={chamber} />
              ))}
            </div>

            <div className="hairline mt-20" />

            {/* Closing CTA */}
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <Link
                to="/"
                className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors"
                style={{ borderColor: "#C9A961", color: "#F5F2EC" }}
                data-testid="receipts-cta-cortex"
              >
                Step inside the cortex
              </Link>
              <Link
                to="/about"
                className="smallcaps text-ash hover:text-bone transition-colors"
                data-testid="receipts-cta-about"
              >
                Why a cortex? →
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function ChamberReceipts({ chamber }) {
  const t = CHAMBER_THEME[chamber.id];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      data-testid={`receipts-chamber-${chamber.id}`}
    >
      <div className="flex items-baseline justify-between gap-4 border-b pb-4" style={{ borderColor: t.accent + "55" }}>
        <div>
          <p className="smallcaps" style={{ color: t.accent }}>{chamber.biology}</p>
          <h3
            className="cortex-display mt-1 text-4xl text-pearl md:text-5xl"
            style={{ fontWeight: 700 }}
          >
            {chamber.name}
          </h3>
        </div>
        <span className="smallcaps tabular text-ash">
          {chamber.council.length} {chamber.council.length === 1 ? "voice" : "voices"}
        </span>
      </div>
      <p className="cortex-editorial mt-4 text-bone/70 max-w-3xl">{chamber.domain}</p>

      <div className="mt-10 space-y-10">
        {chamber.council.map((m) => (
          <PersonaReceipt key={m.id} member={m} chamberId={chamber.id} />
        ))}
      </div>
    </motion.section>
  );
}

function PersonaReceipt({ member, chamberId }) {
  const t = CHAMBER_THEME[chamberId];
  return (
    <article
      className="grid grid-cols-1 gap-6 border bg-carbon/70 p-6 md:grid-cols-12 md:gap-8 md:p-8"
      style={{ borderColor: "#2A2A36", borderRadius: 2 }}
      data-testid={`receipt-${member.id}`}
    >
      {/* Left: glyph + name */}
      <div className="md:col-span-4">
        <div
          className="flex h-14 w-14 items-center justify-center border"
          style={{
            borderColor: t.accent + "77",
            color: t.accent,
            borderRadius: 2,
          }}
        >
          <Glyph name={member.glyph} size={30} />
        </div>
        <h4
          className="cortex-display mt-4 text-2xl text-pearl md:text-3xl"
          style={{ fontWeight: 600 }}
        >
          {member.name}
        </h4>
        {member.dates && (
          <p className="smallcaps tabular mt-1 text-ash">{member.dates}</p>
        )}
        <p className="smallcaps mt-2" style={{ color: t.accent, opacity: 0.85 }}>
          {member.lineage}
        </p>
        <p className="cortex-editorial mt-4 text-sm leading-relaxed text-bone/70">
          {member.voice_notes}
        </p>
      </div>

      {/* Right: source ledger */}
      <div className="md:col-span-8 md:border-l md:border-slate/60 md:pl-8">
        <p className="smallcaps text-ash mb-4">Sources we reasoned from</p>
        {member.sources && member.sources.length > 0 ? (
          <ul className="divide-y divide-slate/60">
            {member.sources.map((s) => (
              <li
                key={`${member.id}-${s.title}`}
                className="grid grid-cols-12 items-baseline gap-3 py-3"
                data-testid={`source-${member.id}-${s.title.replace(/\s+/g, '-').slice(0, 32)}`}
              >
                <span
                  className="smallcaps col-span-12 sm:col-span-3"
                  style={{ color: t.accent, opacity: 0.85 }}
                >
                  {s.type}
                </span>
                <span className="cortex-editorial col-span-12 text-bone sm:col-span-7">
                  <span className="italic">{s.title}</span>
                  {s.author && (
                    <span className="text-bone/60"> — {s.author}</span>
                  )}
                </span>
                <span className="smallcaps tabular col-span-12 text-ash sm:col-span-2 sm:text-right">
                  {s.year || ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cortex-editorial text-bone/60">No sources catalogued.</p>
        )}
      </div>
    </article>
  );
}

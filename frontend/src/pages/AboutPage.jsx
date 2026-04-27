import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { CHAMBER_THEME } from "@/lib/chambers";

const SECTIONS = [
  {
    title: "Why a cortex.",
    body:
      "Every other AI tool collapses complexity into one voice. The human mind does not work this way. We deliberate. We weigh. Faculties argue. Cerebral Cortex preserves that structure — multiple chambers, deliberating in parallel, integrated into a unified verdict.",
  },
  {
    title: "Why five chambers.",
    body:
      "Four lobes — Frontal, Parietal, Temporal, Occipital — each with a domain. Power, enterprise, family, conscience. The fifth is not a peer of the four. The Forge is the corpus callosum: the bridge between hemispheres, the integrator. When a question is too tangled for any single chamber, the Forge calls witnesses and hammers their voices into one verdict.",
  },
  {
    title: "Why archetypes, not chatbots.",
    body:
      "Each chamber holds a council of named figures — Lincoln and Aurelius in the Senate, Buffett and Munger in the Boardroom, Wendell Berry and Brené Brown in the Court Room, Aquinas and C.S. Lewis in the Council. They speak in turn. They may disagree. The chamber renders judgment over them. You receive a verdict, not a chat reply.",
  },
  {
    title: "Reconstructions, with receipts.",
    body:
      "These voices are reconstructions, not channelings. We reason from each figure's public record — their books, letters, speeches, biographies — to what they would most likely say to your question. Every voice is listed on the Receipts page with the works we drew from. We may be wrong. They are not bound by us. Adjust accordingly.",
  },
  {
    title: "What this is not.",
    body:
      "Not therapy. Not legal counsel. Not a substitute for the human beings whose love and authority you already owe. It is a deliberation engine — a place to bring hard questions and hear them weighed by voices you would not otherwise convene.",
  },
];

export default function AboutPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
        <p className="smallcaps text-ash">About the Cortex</p>
        <h2 className="cortex-display mt-2 text-5xl text-pearl md:text-6xl" style={{ fontWeight: 700 }}>
          A whole mind <span className="italic" style={{ color: "#C9A961" }}>at work.</span>
        </h2>
        <p className="cortex-display mt-6 text-2xl italic text-bone/85 md:text-3xl">
          Real wisdom is never one voice.
        </p>

        <div className="hairline mt-10" />

        {SECTIONS.map((s, i) => (
          <section key={i} className="mt-12" data-testid={`about-section-${i}`}>
            <h3 className="cortex-display text-3xl text-pearl" style={{ fontWeight: 600 }}>
              {s.title}
            </h3>
            <p className="cortex-editorial mt-4 text-lg leading-relaxed text-bone/80">
              {s.body}
            </p>
          </section>
        ))}

        <div className="hairline mt-16" />

        <section className="mt-12" data-testid="about-chambers">
          <h3 className="cortex-display text-3xl text-pearl" style={{ fontWeight: 600 }}>
            The Five.
          </h3>
          <ul className="mt-6 divide-y divide-slate/60 border-y border-slate/60">
            {Object.values(CHAMBER_THEME).map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:gap-6">
                <span
                  className="cortex-display text-2xl italic"
                  style={{ color: c.accent, minWidth: 200, fontWeight: 600 }}
                >
                  {c.name}
                </span>
                <span className="smallcaps text-ash min-w-[160px]">{c.biology}</span>
                <span className="cortex-editorial text-bone/75">{c.domain}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 flex flex-wrap items-center gap-4">
          <Link
            to="/"
            className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors"
            style={{ borderColor: "#C9A961", color: "#F5F2EC" }}
            data-testid="about-cta-cortex"
          >
            Step inside the cortex
          </Link>
          <Link
            to="/receipts"
            className="smallcaps text-ash hover:text-bone transition-colors"
            data-testid="about-cta-receipts"
          >
            Read the receipts →
          </Link>
          <Link
            to="/forge"
            className="smallcaps text-ash hover:text-bone transition-colors"
            data-testid="about-cta-forge"
          >
            Or visit the Forge →
          </Link>
        </div>
      </div>
    </Layout>
  );
}

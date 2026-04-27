import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import { CHAMBER_THEME } from "@/lib/chambers";
import { fetchArchive, deleteFromArchive } from "@/lib/api";

export default function ArchivePage() {
  const [verdicts, setVerdicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchArchive()
      .then(setVerdicts)
      .catch(() => setVerdicts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onRemove = async (id) => {
    try {
      await deleteFromArchive(id);
      setVerdicts((vs) => vs.filter((v) => v.id !== id));
      toast.success("Removed from archive.");
    } catch {
      toast.error("Could not remove.");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <p className="smallcaps text-ash">Archive</p>
        <h2 className="cortex-display mt-2 text-5xl text-pearl md:text-6xl" style={{ fontWeight: 700 }}>
          Past Verdicts
        </h2>
        <p className="cortex-editorial mt-3 max-w-2xl text-bone/70">
          Verdicts you've committed. They live with the cortex, retrievable by the link of any one.
        </p>

        <div className="hairline mt-10" />

        {loading && <p className="cortex-display italic text-bone/60 mt-10">Retrieving…</p>}

        {!loading && verdicts.length === 0 && (
          <div className="mt-16" data-testid="archive-empty">
            <p className="cortex-display text-2xl italic text-bone/70">
              The archive is silent.
            </p>
            <p className="cortex-editorial mt-2 text-bone/55">
              When you save a verdict, it will be kept here.
            </p>
            <Link
              to="/"
              className="cortex-ui mt-7 inline-block border border-slate px-5 py-2.5 text-sm text-bone hover:border-bone/40 transition-colors"
              data-testid="archive-empty-cta"
            >
              Return to the cortex
            </Link>
          </div>
        )}

        {!loading && verdicts.length > 0 && (
          <div
            className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="archive-grid"
          >
            {verdicts.map((v) => {
              const t = CHAMBER_THEME[v.chamber_id] || CHAMBER_THEME.senate;
              return (
                <div
                  key={v.id}
                  className="group relative flex flex-col border bg-carbon/85 p-6 transition-all duration-500"
                  style={{
                    borderColor: "#2A2A36",
                    borderRadius: 2,
                    boxShadow: `inset 4px 0 0 ${t.accent}`,
                  }}
                  data-testid={`archive-card-${v.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="smallcaps" style={{ color: t.accent }}>
                      {v.chamber}
                    </span>
                    <span className="smallcaps tabular text-ash">
                      {new Date(v.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <h4 className="cortex-display mt-3 text-xl italic text-pearl line-clamp-3" style={{ fontWeight: 500 }}>
                    {v.question}
                  </h4>
                  <p className="cortex-editorial mt-3 line-clamp-3 text-sm text-bone/70">
                    {v.verdict}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate/60 pt-4">
                    <Link
                      to={`/verdict/${v.id}`}
                      className="smallcaps text-bone hover:text-pearl transition-colors"
                      data-testid={`archive-open-${v.id}`}
                    >
                      Read verdict →
                    </Link>
                    <button
                      onClick={() => onRemove(v.id)}
                      className="smallcaps text-ash hover:text-[#E89A9A] transition-colors"
                      data-testid={`archive-remove-${v.id}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import VerdictLayout from "@/components/VerdictLayout";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";
import { fetchChamber, fetchVerdict, saveVerdict } from "@/lib/api";

export default function VerdictPage() {
  const { id } = useParams();
  const [verdict, setVerdict] = useState(null);
  const [chamber, setChamber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchVerdict(id)
      .then(async (v) => {
        if (!alive) return;
        setVerdict(v);
        try {
          const c = await fetchChamber(v.chamber_id);
          if (alive) setChamber(c);
        } catch {
          // chamber lookup is decorative for the verdict page
        }
      })
      .catch(() => alive && setError("This verdict could not be retrieved."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const onSave = async () => {
    if (!verdict || saving) return;
    setSaving(true);
    try {
      await saveVerdict(verdict.id);
      setVerdict({ ...verdict, saved: true });
      toast.success("Committed to your archive.");
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied.");
    } catch {
      toast.message(window.location.href);
    }
  };

  const accent = verdict ? verdict.chamber_id : null;
  const t = accent ? CHAMBER_THEME[accent] : null;
  const atmo = t ? getImage(t.atmosphere) : null;

  return (
    <Layout accentChamber={accent}>
      {t && atmo && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[440px] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${atmo})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: t.opacity,
              mixBlendMode: t.blendMode,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${t.primary}33, transparent 60%), linear-gradient(180deg, transparent 60%, #0A0A0F 100%)`,
            }}
          />
        </div>
      )}

      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-12 md:px-10 md:pt-16">
        {loading && <p className="cortex-display italic text-bone/60">Retrieving the verdict…</p>}
        {error && (
          <div data-testid="verdict-page-error">
            <p className="cortex-display text-3xl text-pearl">{error}</p>
            <Link to="/" className="smallcaps mt-6 inline-block text-ash hover:text-bone">
              Return to the cortex
            </Link>
          </div>
        )}
        {verdict && (
          <>
            <div className="mb-10">
              <p className="smallcaps" style={{ color: t.accent }}>{verdict.chamber}</p>
              <h2
                className="cortex-display mt-2 text-4xl text-pearl md:text-5xl"
                style={{ fontWeight: 700 }}
              >
                A Verdict, Rendered
              </h2>
            </div>
            <VerdictLayout verdict={verdict} council={chamber?.council || []} showActions>
              <button
                onClick={onSave}
                disabled={saving || verdict.saved}
                className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                style={{ borderColor: t.accent, color: "#F5F2EC" }}
                data-testid="verdict-save"
              >
                {verdict.saved ? "In your archive" : saving ? "Committing…" : "Save to archive"}
              </button>
              <button
                onClick={onShare}
                className="cortex-ui inline-flex items-center gap-2 border border-slate px-5 py-2.5 text-sm text-bone hover:border-bone/40 transition-colors"
                data-testid="verdict-share"
              >
                Copy link
              </button>
              <Link to="/" className="smallcaps text-ash hover:text-bone transition-colors ml-auto">
                Return to cortex
              </Link>
            </VerdictLayout>
          </>
        )}
      </div>
    </Layout>
  );
}

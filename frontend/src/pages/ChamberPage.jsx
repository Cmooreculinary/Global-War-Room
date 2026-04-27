import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import QuestionInput from "@/components/QuestionInput";
import CouncilMemberCard from "@/components/CouncilMemberCard";
import VerdictLayout from "@/components/VerdictLayout";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";
import { fetchChamber, deliberate, saveVerdict } from "@/lib/api";

export default function ChamberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamber, setChamber] = useState(null);
  const [question, setQuestion] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const t = CHAMBER_THEME[id];

  useEffect(() => {
    let alive = true;
    setVerdict(null);
    setQuestion("");
    setError(null);
    fetchChamber(id)
      .then((c) => alive && setChamber(c))
      .catch(() => alive && setError("This chamber could not be reached."));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!t) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl px-6 py-20 md:px-10">
          <p className="cortex-display text-3xl text-pearl">Unknown chamber.</p>
          <Link to="/" className="smallcaps mt-6 inline-block text-ash hover:text-bone">
            Return to the cortex
          </Link>
        </div>
      </Layout>
    );
  }

  const onConvene = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const v = await deliberate(id, question.trim());
      setVerdict(v);
    } catch (e) {
      const msg = e?.response?.data?.detail || chamber?.error || "Deliberation failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!verdict || saving) return;
    setSaving(true);
    try {
      await saveVerdict(verdict.id);
      toast.success("Verdict committed to your archive.");
      setVerdict({ ...verdict, saved: true });
    } catch {
      toast.error("Could not save the verdict.");
    } finally {
      setSaving(false);
    }
  };

  const onShare = async () => {
    if (!verdict) return;
    const url = `${window.location.origin}/verdict/${verdict.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Verdict link copied.");
    } catch {
      toast.message(url);
    }
  };

  const onAskAgain = () => {
    setVerdict(null);
    setQuestion("");
  };

  return (
    <Layout accentChamber={id}>
      <ChamberAtmosphere chamberId={id} />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-10 md:px-10 md:pt-16">
        {!verdict && (
          <ChamberHeader chamber={chamber} chamberId={id} />
        )}

        <AnimatePresence mode="wait">
          {!verdict ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12"
            >
              <div className="lg:col-span-7">
                <p className="smallcaps text-ash">The Question</p>
                <h3 className="cortex-display mt-2 text-3xl italic text-pearl md:text-4xl">
                  {chamber?.tagline || t.name}
                </h3>
                <div className="mt-8">
                  <QuestionInput
                    chamberId={id}
                    value={question}
                    onChange={setQuestion}
                    placeholder={chamber?.placeholder || "Speak the matter…"}
                    disabled={loading}
                  />
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    onClick={onConvene}
                    disabled={loading || !question.trim()}
                    className="group inline-flex items-center gap-3 border px-7 py-3.5 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor: t.accent,
                      backgroundColor: `${t.primary}22`,
                      color: "#F5F2EC",
                    }}
                    data-testid="chamber-convene-button"
                  >
                    <span className="cortex-ui text-sm tracking-wide">
                      {loading ? chamber?.loading || "Convening…" : chamber?.cta || `Convene ${t.name}`}
                    </span>
                    {!loading && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8 H 13 M9 4 L 13 8 L 9 12"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <span className="smallcaps text-ash">
                    {loading ? "The council deliberates" : "It will take a moment"}
                  </span>
                </div>
                {error && (
                  <p className="cortex-editorial mt-6 text-sm" style={{ color: "#E89A9A" }} data-testid="chamber-error">
                    {error}
                  </p>
                )}
              </div>

              <aside className="lg:col-span-5">
                <p className="smallcaps text-ash">The Council</p>
                <h4
                  className="cortex-display mt-2 text-2xl text-pearl"
                  style={{ fontWeight: 600 }}
                >
                  Voices that will speak
                </h4>
                <div className="mt-6 space-y-3" data-testid="council-list">
                  {chamber?.council?.map((m) => (
                    <CouncilMemberCard key={m.id} member={m} chamberId={id} />
                  ))}
                </div>
              </aside>
            </motion.div>
          ) : (
            <motion.div
              key="verdict"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="mt-4"
            >
              <VerdictLayout verdict={verdict} council={chamber?.council || []} showActions>
                <button
                  onClick={onSave}
                  disabled={saving || verdict.saved}
                  className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                  style={{ borderColor: t.accent, color: "#F5F2EC" }}
                  data-testid="verdict-save"
                >
                  {verdict.saved ? "Committed to archive" : saving ? "Committing…" : "Save to archive"}
                </button>
                <button
                  onClick={onShare}
                  className="cortex-ui inline-flex items-center gap-2 border border-slate px-5 py-2.5 text-sm text-bone hover:border-bone/40 transition-colors"
                  data-testid="verdict-share"
                >
                  Share verdict
                </button>
                <button
                  onClick={onAskAgain}
                  className="smallcaps text-ash hover:text-bone transition-colors"
                  data-testid="verdict-ask-again"
                >
                  Ask again
                </button>
                <Link to="/" className="smallcaps text-ash hover:text-bone transition-colors ml-auto">
                  Return to cortex
                </Link>
              </VerdictLayout>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function ChamberHeader({ chamber, chamberId }) {
  const t = CHAMBER_THEME[chamberId];
  return (
    <div className="border-b border-slate/60 pb-8" data-testid="chamber-header">
      <p className="smallcaps" style={{ color: t.accent }}>
        {chamber?.biology || t.biology}
      </p>
      <h2
        className="cortex-display mt-2 text-5xl tracking-tight text-pearl md:text-6xl"
        style={{ fontWeight: 700 }}
      >
        {chamber?.name || t.name}
      </h2>
      <p className="cortex-editorial mt-3 max-w-2xl text-base text-bone/75 md:text-lg">
        {chamber?.domain || t.domain}
      </p>
    </div>
  );
}

function ChamberAtmosphere({ chamberId }) {
  const t = CHAMBER_THEME[chamberId];
  const url = getImage(t.atmosphere);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[680px] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: t.opacity,
          mixBlendMode: t.blendMode,
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${t.primary}40, transparent 60%), linear-gradient(180deg, transparent 60%, #0A0A0F 100%)`,
        }}
      />
    </div>
  );
}

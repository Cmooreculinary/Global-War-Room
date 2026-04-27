import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import QuestionInput from "@/components/QuestionInput";
import VerdictLayout from "@/components/VerdictLayout";
import ForgeQuadrant from "@/components/ForgeQuadrant";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";
import { fetchChamber, deliberate, saveVerdict } from "@/lib/api";

const CHAMBER_KEYWORDS = {
  senate: ["leader", "lead", "ceo", "country", "law", "public", "governance", "team", "founder", "constitu", "vote", "election", "power", "reputation", "decision", "fire", "hire executive", "board"],
  boardroom: ["money", "revenue", "profit", "invest", "stock", "valuation", "raise", "pricing", "strategy", "market", "operation", "ship", "launch", "product", "customer", "company", "business", "deal"],
  courtroom: ["wife", "husband", "marriage", "kids", "children", "child", "family", "father", "mother", "son", "daughter", "spouse", "home", "covenant", "loved", "friend", "betray"],
  council: ["god", "faith", "pray", "soul", "sin", "scripture", "bible", "church", "moral", "conscience", "right", "wrong", "ethic", "virtue", "calling", "vocation", "purpose"],
};

function previewChambers(text) {
  if (!text || text.trim().length < 10) return [];
  const t = text.toLowerCase();
  const hits = new Set();
  for (const [id, kws] of Object.entries(CHAMBER_KEYWORDS)) {
    for (const kw of kws) {
      if (t.includes(kw)) {
        hits.add(id);
        break;
      }
    }
  }
  return Array.from(hits).slice(0, 4);
}

export default function ForgePage() {
  const [chamber, setChamber] = useState(null);
  const [question, setQuestion] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const t = CHAMBER_THEME.forge;
  const ember = getImage("texture_forge");
  const preview = previewChambers(question);

  useEffect(() => {
    fetchChamber("forge").then(setChamber).catch(() => {});
  }, []);

  const onForge = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const v = await deliberate("forge", question.trim());
      setVerdict(v);
    } catch (e) {
      const msg = e?.response?.data?.detail || chamber?.error || "The Forge has cooled.";
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
    setError(null);
  };

  return (
    <Layout accentChamber="forge">
      {/* Forge atmosphere — ember background, heat shimmer */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[760px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${ember})`,
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
            opacity: 0.32,
            mixBlendMode: "screen",
            filter: "saturate(1.2) contrast(1.05)",
          }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(255,229,180,0.40), rgba(200,74,31,0.20) 35%, transparent 70%)",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,15,0.5) 0%, transparent 30%, transparent 70%, #0A0A0F 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-10 md:px-10 md:pt-16">
        {!verdict && <ForgeHeader chamber={chamber} />}

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
                <p className="smallcaps" style={{ color: t.accent }}>
                  Lay the question on the anvil
                </p>
                <h3 className="cortex-display mt-2 text-3xl italic text-pearl md:text-4xl">
                  {chamber?.tagline || "Some questions belong to no single chamber."}
                </h3>

                <div className="mt-8">
                  <QuestionInput
                    chamberId="forge"
                    value={question}
                    onChange={setQuestion}
                    placeholder={chamber?.placeholder || "Lay the tangled question on the anvil…"}
                    disabled={loading}
                  />
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    onClick={onForge}
                    disabled={loading || !question.trim()}
                    className="group inline-flex items-center gap-3 border px-7 py-3.5 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor: t.accent,
                      backgroundColor: "rgba(200,74,31,0.18)",
                      color: "#FFE5B4",
                      boxShadow: "0 0 28px rgba(200,74,31,0.35)",
                    }}
                    data-testid="forge-button"
                  >
                    <span className="cortex-ui text-sm tracking-wide">
                      {loading ? chamber?.loading || "The iron is heating…" : chamber?.cta || "Bring it to the Forge"}
                    </span>
                  </button>
                  <span className="smallcaps text-ash">
                    {loading ? "Witnesses are convening" : "Multi-chamber deliberation"}
                  </span>
                </div>
                {error && (
                  <p className="cortex-editorial mt-6 text-sm" style={{ color: "#FFB59C" }} data-testid="forge-error">
                    {error}
                  </p>
                )}
              </div>

              <aside className="lg:col-span-5">
                <p className="smallcaps" style={{ color: t.accent }}>
                  Witnesses to be called
                </p>
                <h4 className="cortex-display mt-2 text-2xl text-pearl" style={{ fontWeight: 600 }}>
                  Chambers listening
                </h4>
                <p className="cortex-editorial mt-2 text-sm text-bone/60">
                  As you write, the Forge listens for which chambers must speak.
                </p>
                <div className="mt-6">
                  <ForgeQuadrant activeChambers={preview} />
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
              <div className="mx-auto mb-10 max-w-4xl">
                <p className="smallcaps mb-3" style={{ color: t.accent }}>
                  Witnesses called by the Forge
                </p>
                <ForgeQuadrant called={verdict.witnesses_called || []} />
              </div>
              <VerdictLayout
                verdict={verdict}
                council={(verdict.witnesses_called || []).map((cid) => ({
                  name: CHAMBER_THEME[cid]?.name || cid,
                  glyph: glyphForChamber(cid),
                  lineage: `Witness from ${CHAMBER_THEME[cid]?.biology || ""}`,
                }))}
                showActions
              >
                <button
                  onClick={onSave}
                  disabled={saving || verdict.saved}
                  className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                  style={{ borderColor: t.accent, color: "#FFE5B4" }}
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
                  Forge another
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

function glyphForChamber(cid) {
  return { senate: "laurel", boardroom: "ledger", courtroom: "hearth", council: "book", forge: "anvil" }[cid] || "anvil";
}

function ForgeHeader({ chamber }) {
  return (
    <div className="border-b pb-8" style={{ borderColor: "rgba(200,74,31,0.35)" }} data-testid="forge-header">
      <p className="smallcaps" style={{ color: "#FFE5B4" }}>
        Corpus Callosum — the integrator
      </p>
      <h2
        className="cortex-display mt-2 text-5xl tracking-tight md:text-6xl"
        style={{ fontWeight: 700, color: "#F5F2EC" }}
      >
        The Forge
      </h2>
      <p className="cortex-editorial mt-3 max-w-2xl text-base text-bone/80 md:text-lg">
        {chamber?.domain ||
          "The unclassified, the tangled. The Forge calls witnesses from the other chambers and hammers their voices into a single coherent verdict."}
      </p>
    </div>
  );
}

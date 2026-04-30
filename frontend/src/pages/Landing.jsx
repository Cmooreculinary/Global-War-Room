// Landing — the single-page Cerebral Cortex experience.
//
// Flow:
//   1. idle: brain breathing; question textarea framed beneath; one CTA.
//   2. routing: brain pulses globally; "convening" status — a quick router call decides chair + witnesses.
//   3. deliberating: only the active lobe(s) blaze; others dim; chamber-flavored status rotates.
//   4. verdict: verdict + deliberation drop in below the brain; brain settles with chair lobe still glowing.
//
// All on /. No chamber selection — the model picks.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import CortexHero from "@/components/CortexHero";
import VerdictLayout from "@/components/VerdictLayout";
import { CHAMBER_THEME } from "@/lib/chambers";
import { CONVENING_MESSAGES, getChamberMessages } from "@/lib/loadingMessages";
import { deliberate, fetchChamber, routeQuestion, saveVerdict } from "@/lib/api";

const PHASES = {
  IDLE: "idle",
  ROUTING: "routing",
  DELIBERATING: "deliberating",
  VERDICT: "verdict",
  ERROR: "error",
};

const ROUTING_MESSAGES = [
  "Reading the question.",
  "Routing to the right chamber.",
];

const COMMITTEE_PRELUDE = [
  "The matter is crossing chambers.",
  "Witnesses are being called.",
];

export default function Landing() {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [question, setQuestion] = useState("");
  const [routed, setRouted] = useState(null); // { chamber_id, witnesses, reasoning }
  const [verdict, setVerdict] = useState(null);
  const [chamberInfo, setChamberInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const verdictRef = useRef(null);

  const onConvene = async () => {
    const q = question.trim();
    if (!q || phase !== PHASES.IDLE) return;
    setErrorMsg("");
    setVerdict(null);
    setChamberInfo(null);

    try {
      // Phase 1 — route
      setPhase(PHASES.ROUTING);
      const r = await routeQuestion(q);
      setRouted(r);

      // Phase 2 — deliberate (with the routed chamber)
      setPhase(PHASES.DELIBERATING);
      const v = await deliberate(r.chamber_id, q);
      setVerdict(v);

      // Best-effort fetch chamber info for council display
      try {
        const c = await fetchChamber(v.chamber_id);
        setChamberInfo(c);
      } catch {
        // decorative; verdict still renders without it
      }

      setPhase(PHASES.VERDICT);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        "The cortex paused. Please try again in a moment.";
      setErrorMsg(msg);
      setPhase(PHASES.ERROR);
      toast.error(msg);
    }
  };

  const onAskAgain = () => {
    setPhase(PHASES.IDLE);
    setQuestion("");
    setRouted(null);
    setVerdict(null);
    setChamberInfo(null);
    setErrorMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSave = async () => {
    if (!verdict || saving || verdict.saved) return;
    setSaving(true);
    try {
      await saveVerdict(verdict.id);
      setVerdict({ ...verdict, saved: true });
      toast.success("Committed to your archive.");
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

  // Auto-scroll to verdict when it arrives
  useEffect(() => {
    if (phase === PHASES.VERDICT && verdictRef.current) {
      const t = setTimeout(() => {
        verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Active chambers driving the brain glow
  const activeChambers = useMemo(() => {
    if (phase === PHASES.DELIBERATING && routed) {
      return [routed.chamber_id, ...(routed.witnesses || [])];
    }
    if (phase === PHASES.VERDICT && verdict) {
      const list = [verdict.chamber_id];
      if (verdict.witnesses_called) {
        verdict.witnesses_called.forEach((w) => {
          if (!list.includes(w)) list.push(w);
        });
      }
      return list;
    }
    return [];
  }, [phase, routed, verdict]);

  const brainMode =
    phase === PHASES.DELIBERATING || phase === PHASES.ROUTING
      ? "deliberating"
      : phase === PHASES.VERDICT
      ? "verdict"
      : "idle";

  return (
    <Layout accentChamber={verdict?.chamber_id || null}>
      <section
        className="relative mx-auto max-w-7xl px-6 pb-12 pt-10 md:px-10 md:pb-16 md:pt-16"
        data-testid="landing-hero"
      >
        {/* Tagline above the brain */}
        <div className="mb-8 text-center md:mb-10">
          <p className="smallcaps text-ash">A deliberation engine</p>
          <h1
            className="cortex-display mt-2 text-5xl tracking-tight text-pearl md:text-7xl"
            style={{ fontWeight: 700 }}
            data-testid="landing-title"
          >
            Cerebral <span className="italic" style={{ color: "#C9A961" }}>Cortex</span>
          </h1>
          <p className="cortex-display mt-4 text-xl italic text-bone/85 md:text-2xl">
            Real wisdom is never one voice.
            <span className="text-bone/60"> It's a whole mind at work.</span>
          </p>
        </div>

        {/* The brain */}
        <CortexHero mode={brainMode} activeChambers={activeChambers} />

        {/* Deliberation status — only during routing/deliberating */}
        <AnimatePresence mode="wait">
          {(phase === PHASES.ROUTING || phase === PHASES.DELIBERATING) && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5 }}
              className="mt-12 md:mt-16"
              data-testid="deliberation-status-row"
            >
              <DeliberationStatus
                phase={phase}
                routed={routed}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context window — question textarea or echoed question */}
        <AnimatePresence mode="wait">
          {phase === PHASES.IDLE || phase === PHASES.ERROR ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.55 }}
              className="mx-auto mt-16 max-w-3xl md:mt-20"
            >
              <ContextWindow
                question={question}
                onChange={setQuestion}
                onConvene={onConvene}
                error={errorMsg}
              />

              {/* How it works strip */}
              <div className="mt-16 grid grid-cols-1 gap-7 sm:grid-cols-3">
                {[
                  ["1", "Bring a question.", "The matter you cannot solve alone."],
                  ["2", "The cortex routes.", "The right chamber convenes its council."],
                  ["3", "A verdict is rendered.", "Deliberated. Integrated. Plainspoken."],
                ].map(([num, head, sub]) => (
                  <div key={num} data-testid={`how-step-${num}`}>
                    <p className="cortex-display tabular text-3xl" style={{ color: "#C9A961", fontWeight: 600 }}>
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

              <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-center">
                <Link to="/receipts" className="smallcaps text-ash hover:text-bone transition-colors" data-testid="landing-cta-receipts">
                  Read the receipts →
                </Link>
                <Link to="/about" className="smallcaps text-ash hover:text-bone transition-colors" data-testid="landing-cta-about">
                  Why a cortex?
                </Link>
                <Link to="/archive" className="smallcaps text-ash hover:text-bone transition-colors" data-testid="landing-cta-archive">
                  The archive
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="echo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="mx-auto mt-12 max-w-3xl md:mt-16"
            >
              <QuestionEcho question={question} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verdict */}
        <AnimatePresence>
          {phase === PHASES.VERDICT && verdict && (
            <motion.div
              key="verdict"
              ref={verdictRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="mt-20 md:mt-28"
              data-testid="verdict-section"
            >
              {verdict.committee && verdict.witnesses_called && verdict.witnesses_called.length > 1 && (
                <CommitteeBanner verdict={verdict} />
              )}
              <VerdictLayout
                verdict={verdict}
                council={renderCouncil(verdict, chamberInfo)}
                showActions
              >
                <button
                  onClick={onSave}
                  disabled={saving || verdict.saved}
                  className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                  style={{
                    borderColor: CHAMBER_THEME[verdict.chamber_id]?.accent || "#C9A961",
                    color: "#F5F2EC",
                  }}
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
                  Ask another
                </button>
              </VerdictLayout>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </Layout>
  );
}

// --------------------------------------------------------------------------- //
// Sub-components                                                              //
// --------------------------------------------------------------------------- //

function ContextWindow({ question, onChange, onConvene, error }) {
  const onKeyDown = (e) => {
    // Cmd/Ctrl + Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onConvene();
    }
  };
  return (
    <div data-testid="context-window">
      <p className="smallcaps text-center text-ash">The Question</p>
      <h3 className="cortex-display mt-2 text-center text-2xl italic text-pearl md:text-3xl">
        Bring the matter you cannot solve alone.
      </h3>

      <div className="relative mt-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,28,0.65), rgba(10,10,15,0.85))",
            borderRadius: 2,
          }}
        />
        <textarea
          data-testid="question-input"
          value={question}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Speak the matter…"
          rows={5}
          className="relative z-10 block w-full resize-none border bg-transparent px-7 py-6 text-bone placeholder:text-ash focus:outline-none cortex-editorial text-[1.08rem] leading-relaxed"
          style={{
            borderColor: "#C9A96155",
            borderRadius: 2,
            minHeight: 168,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px #C9A96110",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#C9A961";
            e.target.style.boxShadow =
              "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px #C9A961, 0 0 28px rgba(201,169,97,0.35)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#C9A96155";
            e.target.style.boxShadow =
              "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 0 1px #C9A96110";
          }}
        />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-5">
        <button
          onClick={onConvene}
          disabled={!question.trim()}
          className="group inline-flex items-center gap-3 border px-7 py-3.5 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "#C9A961",
            color: "#F5F2EC",
            backgroundColor: "rgba(139,26,26,0.20)",
          }}
          data-testid="convene-button"
        >
          <span className="cortex-ui text-sm tracking-wide">Convene the council</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8 H 13 M9 4 L 13 8 L 9 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="smallcaps text-ash">⌘ + ⏎</span>
      </div>

      {error && (
        <p className="cortex-editorial mt-6 text-center text-sm" style={{ color: "#E89A9A" }} data-testid="landing-error">
          {error}
        </p>
      )}
    </div>
  );
}

function QuestionEcho({ question }) {
  return (
    <div
      className="border-l-2 pl-6 md:pl-8"
      style={{ borderColor: "#C9A961" }}
      data-testid="question-echo"
    >
      <p className="smallcaps text-ash">The Question Brought</p>
      <p className="cortex-display italic mt-2 text-2xl text-pearl md:text-3xl leading-snug">
        {question}
      </p>
    </div>
  );
}

function DeliberationStatus({ phase, routed }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    setMsgIdx(0);
    const id = setInterval(() => setMsgIdx((i) => i + 1), 3200);
    return () => clearInterval(id);
  }, [phase]);

  const messages = useMemo(() => {
    if (phase === PHASES.ROUTING) return ROUTING_MESSAGES;
    if (!routed) return ROUTING_MESSAGES;
    const isCommittee =
      routed.chamber_id === "forge" ||
      (routed.witnesses && routed.witnesses.length > 0);
    const chamberMsgs = getChamberMessages(routed.chamber_id, isCommittee);
    return isCommittee ? [...COMMITTEE_PRELUDE, ...chamberMsgs] : chamberMsgs;
  }, [phase, routed]);

  const status = messages[msgIdx % messages.length] || CONVENING_MESSAGES[0];

  const accent =
    routed && CHAMBER_THEME[routed.chamber_id]
      ? CHAMBER_THEME[routed.chamber_id].accent
      : "#C9A961";

  const label =
    phase === PHASES.ROUTING
      ? "Routing"
      : routed && routed.witnesses && routed.witnesses.length > 0
      ? "Committee in session"
      : routed
      ? `${CHAMBER_THEME[routed.chamber_id]?.name || "The cortex"} in session`
      : "Convening";

  return (
    <div className="text-center" data-testid="status-card">
      <p className="smallcaps" style={{ color: accent, opacity: 0.95 }}>
        {label}
      </p>
      <motion.p
        key={`${phase}-${status}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="cortex-display italic mt-2 text-2xl text-pearl md:text-3xl"
      >
        {status}
      </motion.p>
      {routed && routed.reasoning && (
        <p className="cortex-editorial mt-3 max-w-xl mx-auto text-sm text-bone/55 italic">
          {routed.reasoning}
        </p>
      )}
    </div>
  );
}

function CommitteeBanner({ verdict }) {
  const t = CHAMBER_THEME[verdict.chamber_id];
  return (
    <div
      className="mx-auto mb-10 max-w-4xl border bg-carbon/85 p-5 md:p-6"
      style={{
        borderColor: t.accent + "55",
        borderRadius: 2,
        borderLeftWidth: 3,
        borderLeftColor: t.accent,
      }}
      data-testid="committee-banner"
    >
      <p className="smallcaps" style={{ color: t.accent }}>
        Committee convened
      </p>
      <p className="cortex-display italic mt-1 text-xl md:text-2xl text-pearl">
        The matter crossed chambers. {verdict.chamber} chaired the committee.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {verdict.witnesses_called.map((cid) => {
          const ct = CHAMBER_THEME[cid];
          if (!ct) return null;
          return (
            <span
              key={cid}
              className="cortex-ui inline-flex items-center gap-2 border px-3 py-1.5 text-xs"
              style={{
                borderColor: ct.accent + "66",
                color: "#F5F2EC",
                background: `linear-gradient(135deg, ${ct.primary}1F, transparent)`,
                borderRadius: 2,
              }}
              data-testid={`committee-witness-${cid}`}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: ct.accent }} />
              {ct.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function renderCouncil(verdict, chamberInfo) {
  if (!verdict.committee || !verdict.witnesses_called) {
    return chamberInfo?.council || [];
  }
  const glyphFor = { senate: "laurel", boardroom: "ledger", courtroom: "hearth", council: "book" };
  return verdict.witnesses_called.map((cid) => ({
    name: CHAMBER_THEME[cid]?.name || cid,
    glyph: glyphFor[cid] || "anvil",
    lineage: `Witness from ${CHAMBER_THEME[cid]?.biology || ""}`,
  }));
}

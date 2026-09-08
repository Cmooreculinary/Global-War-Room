// The War Room — five commanders read today's news, once it has been stripped
// of everyone's framing.
//
// Flow:
//   1. intake   : a topic, an optional question, optional pasted material.
//   2. sifting  : coverage is gathered and reduced to a neutral fact sheet.
//   3. brief    : the fact sheet is shown FIRST, so the facts can be checked
//                 before anyone reasons from them.
//   4. board    : five reads, then the estimate.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import SituationBrief, { LeanChip } from "@/components/SituationBrief";
import BoardRead, { MEMBER_META } from "@/components/BoardRead";
import WarEstimate from "@/components/WarEstimate";
import PaywallModal from "@/components/PaywallModal";
import TeamRoster from "@/components/TeamRoster";
import ScenarioBuilder from "@/components/ScenarioBuilder";
import ProjectionView from "@/components/ProjectionView";
import ScenarioView from "@/components/ScenarioView";
import { Glyph } from "@/components/Glyphs";
import { CHAMBER_THEME } from "@/lib/chambers";
import { getImage } from "@/lib/images";
import {
  buildWarRoomBrief,
  conveneWarRoom,
  fetchEntitlement,
  fetchWarRoomSources,
  fetchWarRoomTeams,
  pollRun,
  saveVerdict,
  startProjection,
  startScenario,
} from "@/lib/api";

const PHASES = { INTAKE: "intake", SIFTING: "sifting", BRIEF: "brief", CONVENING: "convening", ESTIMATE: "estimate" };

const SIFT_MESSAGES = [
  "Gathering today's coverage.",
  "Sorting corroborated from claimed.",
  "Stripping the adjectives.",
  "Naming what nobody knows.",
];

const CONVENE_MESSAGES = [
  "The board is reading the map.",
  "Alexander wants to know who must be beaten.",
  "Genghis is asking what the adversary cannot see.",
  "Napoleon is counting the distance.",
  "Churchill is looking ten years out.",
  "Eisenhower is asking what this costs.",
  "Drawing the estimate.",
];

const BOARD_ORDER = Object.keys(MEMBER_META);
const t = CHAMBER_THEME.warroom;

export default function WarRoomPage() {
  const [phase, setPhase] = useState(PHASES.INTAKE);
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [live, setLive] = useState(true);
  const [windowHours, setWindowHours] = useState(24);
  const [includeState, setIncludeState] = useState(false);

  const [briefDoc, setBriefDoc] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [registry, setRegistry] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Team modes — projections and played-out scenarios.
  const [teams, setTeams] = useState([]);
  const [horizon, setHorizon] = useState(5);
  const [run, setRun] = useState(null);
  const [runError, setRunError] = useState("");
  const cancelPollRef = useRef(null);

  const briefRef = useRef(null);
  const estimateRef = useRef(null);
  const runRef = useRef(null);
  const grid = getImage("texture_map");

  useEffect(() => {
    fetchWarRoomSources().then(setRegistry).catch(() => {});
    fetchEntitlement().then(setEntitlement).catch(() => {});
    fetchWarRoomTeams().then((d) => setTeams(d.teams || [])).catch(() => {});
  }, []);

  // Stop polling if the page goes away mid-run; the run itself continues server-side.
  useEffect(() => () => cancelPollRef.current?.(), []);

  const busy = phase === PHASES.SIFTING || phase === PHASES.CONVENING;
  const canSift = topic.trim().length > 2 && !busy;

  const onError = (e, fallback) => {
    if (e?.response?.status === 402) {
      setPaywallOpen(true);
      fetchEntitlement().then(setEntitlement).catch(() => {});
      return true;
    }
    const msg = e?.response?.data?.detail || fallback;
    setError(msg);
    toast.error(msg);
    return false;
  };

  const onSift = async () => {
    if (!canSift) return;
    setError("");
    setResult(null);
    setSaved(false);
    setPhase(PHASES.SIFTING);
    try {
      const doc = await buildWarRoomBrief({
        topic: topic.trim(),
        pasted,
        live,
        windowHours,
        includeState,
      });
      setBriefDoc(doc);
      setPhase(PHASES.BRIEF);
      requestAnimationFrame(() => briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setPhase(PHASES.INTAKE);
      onError(e, "The coverage could not be sifted. Try again in a moment.");
    }
  };

  const onConvene = async () => {
    if (!briefDoc || busy) return;
    setError("");
    setPhase(PHASES.CONVENING);
    try {
      const estimate = await conveneWarRoom({
        briefId: briefDoc.id,
        topic: briefDoc.topic,
        question: question.trim(),
      });
      setResult(estimate);
      setPhase(PHASES.ESTIMATE);
      fetchEntitlement().then(setEntitlement).catch(() => {});
      requestAnimationFrame(() => estimateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setPhase(PHASES.BRIEF);
      onError(e, "The War Room has adjourned. Try again in a moment.");
    }
  };

  const onSave = async () => {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      await saveVerdict(result.id);
      setSaved(true);
      toast.success("Estimate committed to your archive.");
    } catch {
      toast.error("Could not save the estimate.");
    } finally {
      setSaving(false);
    }
  };

  const onShare = async () => {
    if (!result) return;
    const url = `${window.location.origin}/verdict/${result.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.message(url);
    }
  };

  const onRunTeams = async ({ kind, assignments }) => {
    if (!briefDoc || run?.status === "running") return;
    setRunError("");
    cancelPollRef.current?.();
    try {
      const start = kind === "projection" ? startProjection : startScenario;
      const { run_id } = await start({
        briefId: briefDoc.id,
        topic: briefDoc.topic,
        horizonYears: horizon,
        ...(kind === "projection" ? {} : { assignments }),
      });
      setRun({ id: run_id, kind, status: "running", years: [], projections: [], horizon });
      requestAnimationFrame(() => runRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      cancelPollRef.current = pollRun(run_id, setRun, {
        onError: (e) => setRunError(e.message || "The run failed."),
      });
    } catch (e) {
      if (!onError(e, "The exercise could not be started.")) setRunError(e.message || "");
    }
  };

  const onReset = () => {
    setPhase(PHASES.INTAKE);
    setBriefDoc(null);
    setResult(null);
    setError("");
    setSaved(false);
    cancelPollRef.current?.();
    setRun(null);
    setRunError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout accentChamber="warroom">
      <MapAtmosphere grid={grid} />

      <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-10 md:px-10 md:pt-16">
        <Header entitlement={entitlement} />

        {/* ---- Intake ---- */}
        <section className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12" data-testid="warroom-intake">
          <div className="lg:col-span-7">
            <label className="smallcaps" style={{ color: t.accent }} htmlFor="warroom-topic">
              The situation
            </label>
            <input
              id="warroom-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSift && onSift()}
              disabled={busy}
              placeholder="A theatre, a crisis, a rivalry — e.g. the Taiwan Strait"
              className="cortex-editorial mt-2 block w-full border bg-transparent px-5 py-4 text-lg text-bone placeholder:text-ash focus:outline-none"
              style={{ borderColor: `${t.accent}55`, borderRadius: 2, background: "rgba(20,20,28,0.6)" }}
              data-testid="warroom-topic-input"
            />

            <label className="smallcaps mt-6 block" style={{ color: t.accent }} htmlFor="warroom-question">
              Put a question to the board <span className="text-ash">— optional</span>
            </label>
            <input
              id="warroom-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={busy}
              placeholder="What should Washington do in the next ninety days?"
              className="cortex-editorial mt-2 block w-full border bg-transparent px-5 py-3.5 text-bone placeholder:text-ash focus:outline-none"
              style={{ borderColor: "#2A2A36", borderRadius: 2, background: "rgba(20,20,28,0.6)" }}
              data-testid="warroom-question-input"
            />

            {/* Intake controls */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Toggle
                checked={live}
                onChange={setLive}
                disabled={busy || registry?.live_enabled === false}
                label="Pull today's coverage"
                testid="toggle-live"
              />
              <Toggle
                checked={includeState}
                onChange={setIncludeState}
                disabled={busy || !live}
                label="Include state media"
                testid="toggle-state"
              />
              <div className="flex items-center gap-2">
                <span className="smallcaps text-ash">Window</span>
                <select
                  value={windowHours}
                  onChange={(e) => setWindowHours(Number(e.target.value))}
                  disabled={busy || !live}
                  className="cortex-ui border bg-transparent px-2 py-1 text-sm text-bone focus:outline-none disabled:opacity-40"
                  style={{ borderColor: "#2A2A36", borderRadius: 2 }}
                  data-testid="select-window"
                >
                  <option value={12} className="bg-carbon">12 hours</option>
                  <option value={24} className="bg-carbon">24 hours</option>
                  <option value={72} className="bg-carbon">3 days</option>
                  <option value={168} className="bg-carbon">7 days</option>
                </select>
              </div>
            </div>

            {/* Paste-in */}
            <button
              onClick={() => setShowPaste((s) => !s)}
              className="smallcaps mt-5 text-ash transition-colors hover:text-bone"
              data-testid="toggle-paste"
            >
              {showPaste ? "− Hide your own material" : "+ Add your own material"}
            </button>
            <AnimatePresence>
              {showPaste && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    disabled={busy}
                    rows={8}
                    placeholder={
                      "Paste articles, cables, transcripts or reports.\n\n" +
                      "Separate them with --- and label each one so its framing can be tracked:\n\n" +
                      "Reuters: Officials confirmed…\n---\n[The Guardian]\nThe move was condemned by…"
                    }
                    className="cortex-editorial mt-3 block w-full resize-y border bg-transparent px-5 py-4 text-sm leading-relaxed text-bone placeholder:text-ash focus:outline-none"
                    style={{ borderColor: "#2A2A36", borderRadius: 2, background: "rgba(20,20,28,0.6)" }}
                    data-testid="warroom-paste-input"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                onClick={onSift}
                disabled={!canSift}
                className="cortex-ui inline-flex items-center gap-3 border px-7 py-3.5 text-sm tracking-wide transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: t.accent,
                  backgroundColor: "rgba(30,42,51,0.6)",
                  color: t.accent,
                  boxShadow: `0 0 24px ${t.glowRgba}`,
                }}
                data-testid="warroom-sift-button"
              >
                {phase === PHASES.SIFTING ? "Sifting the coverage…" : "Sift the coverage"}
              </button>
              {briefDoc && phase !== PHASES.SIFTING && (
                <button onClick={onReset} className="smallcaps text-ash transition-colors hover:text-bone" data-testid="warroom-reset">
                  Start over
                </button>
              )}
            </div>

            {error && (
              <p className="cortex-editorial mt-5 text-sm" style={{ color: "#D08C7A" }} data-testid="warroom-error">
                {error}
              </p>
            )}
          </div>

          <aside className="lg:col-span-5">
            <BoardRoster teams={teams} />
            <SourceRegistry registry={registry} />
          </aside>
        </section>

        {/* ---- Sifting ---- */}
        <AnimatePresence mode="wait">
          {phase === PHASES.SIFTING && (
            <Working key="sifting" messages={SIFT_MESSAGES} testid="warroom-sifting" />
          )}
        </AnimatePresence>

        {/* ---- Brief ---- */}
        {briefDoc && phase !== PHASES.SIFTING && (
          <motion.section
            ref={briefRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-20 scroll-mt-24"
            data-testid="warroom-brief-section"
          >
            <div className="border-b pb-6" style={{ borderColor: `${t.accent}33` }}>
              <p className="smallcaps" style={{ color: t.accent }}>
                Step one — the record, before anyone argues from it
              </p>
              <h2 className="cortex-display mt-2 text-4xl tracking-tight text-pearl md:text-5xl" style={{ fontWeight: 700 }}>
                Intelligence brief
              </h2>
              <p className="cortex-editorial mt-3 max-w-3xl text-base text-bone/70">
                Read this before the board does. Anything the room gets wrong downstream starts here — if a
                fact is misplaced, correct the material and sift again.
              </p>
            </div>

            <div className="mt-8">
              <SituationBrief brief={briefDoc.brief} sources={briefDoc.sources} items={briefDoc.items} />
            </div>

            {phase === PHASES.BRIEF && (
              <div className="mt-12 flex flex-wrap items-center gap-4 border-t pt-8" style={{ borderColor: "#2A2A36" }}>
                <button
                  onClick={onConvene}
                  className="cortex-ui inline-flex items-center gap-3 border px-7 py-3.5 text-sm tracking-wide transition-all duration-300"
                  style={{
                    borderColor: t.accent,
                    backgroundColor: "rgba(30,42,51,0.6)",
                    color: t.accent,
                    boxShadow: `0 0 24px ${t.glowRgba}`,
                  }}
                  data-testid="warroom-convene-button"
                >
                  Convene the board
                </button>
                <span className="smallcaps text-ash">Five reads, then the estimate</span>
              </div>
            )}
          </motion.section>
        )}

        {/* ---- Convening ---- */}
        <AnimatePresence mode="wait">
          {phase === PHASES.CONVENING && (
            <Working key="convening" messages={CONVENE_MESSAGES} testid="warroom-convening" />
          )}
        </AnimatePresence>

        {/* ---- Board + estimate ---- */}
        {result && phase === PHASES.ESTIMATE && (
          <motion.section
            ref={estimateRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-20 scroll-mt-24"
            data-testid="warroom-board-section"
          >
            <div className="border-b pb-6" style={{ borderColor: `${t.accent}33` }}>
              <p className="smallcaps" style={{ color: t.accent }}>
                Step two — five commanders, one brief
              </p>
              <h2 className="cortex-display mt-2 text-4xl tracking-tight text-pearl md:text-5xl" style={{ fontWeight: 700 }}>
                The board reads it
              </h2>
              {result.question && (
                <p className="cortex-editorial mt-3 max-w-3xl text-base italic text-bone/80">“{result.question}”</p>
              )}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {result.board?.map((row, i) => (
                <BoardRead key={row.member} row={row} index={i} />
              ))}
            </div>

            <div className="mt-16">
              <WarEstimate estimate={result.estimate} />
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-4 border-t pt-8" style={{ borderColor: "#2A2A36" }}>
              <button
                onClick={onSave}
                disabled={saving || saved}
                className="cortex-ui inline-flex items-center border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                style={{ borderColor: t.accent, color: t.accent }}
                data-testid="warroom-save"
              >
                {saved ? "Committed to archive" : saving ? "Committing…" : "Save to archive"}
              </button>
              <button
                onClick={onShare}
                className="cortex-ui inline-flex items-center border border-slate px-5 py-2.5 text-sm text-bone transition-colors hover:border-bone/40"
                data-testid="warroom-share"
              >
                Share estimate
              </button>
              <button onClick={onReset} className="smallcaps text-ash transition-colors hover:text-bone" data-testid="warroom-again">
                Read another situation
              </button>
              <Link to="/cortex" className="smallcaps ml-auto text-ash transition-colors hover:text-bone">
                Return to cortex
              </Link>
            </div>

            <p className="cortex-editorial mt-10 max-w-3xl text-xs leading-relaxed text-ash">
              These are reconstructions, not channelings. Five men who are long dead cannot know today's
              conditions; the room reasons from their documented doctrine to what each would most likely see.
              The estimate is an argument, not a forecast — and no better than the brief it was drawn from.
            </p>
          </motion.section>
        )}

        {/* ---- Team modes: projections and played-out scenarios ---- */}
        {briefDoc && (phase === PHASES.BRIEF || phase === PHASES.ESTIMATE) && teams.length > 0 && (
          <motion.section
            ref={runRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-24 scroll-mt-24"
            data-testid="warroom-teams-section"
          >
            <div className="border-b pb-6" style={{ borderColor: `${t.accent}33` }}>
              <p className="smallcaps" style={{ color: t.accent }}>
                Step three — teams of three, and the next {horizon} years
              </p>
              <h2
                className="cortex-display mt-2 text-4xl tracking-tight text-pearl md:text-5xl"
                style={{ fontWeight: 700 }}
              >
                Play it forward
              </h2>
              <p className="cortex-editorial mt-3 max-w-3xl text-base text-bone/70">
                Each commander now sits with the two consuls he would actually have picked. Take their
                projections, or hand them a country and play the years out — one actor advised by all five,
                or several actors with the teams split between them.
              </p>
            </div>

            <div className="mt-8">
              <ScenarioBuilder
                teams={teams}
                horizon={horizon}
                onHorizonChange={setHorizon}
                onRun={onRunTeams}
                running={run?.status === "running"}
              />
            </div>

            {runError && (
              <p className="cortex-editorial mt-6 text-sm" style={{ color: "#D08C7A" }} data-testid="run-error">
                {runError}
              </p>
            )}

            {run && (
              <div className="mt-12">
                {run.status === "running" && <RunProgress run={run} />}

                {run.kind === "projection" && run.projections?.length > 0 && (
                  <div className="mt-8">
                    <ProjectionView
                      projections={run.projections}
                      comparison={run.comparison}
                      horizon={run.horizon || horizon}
                    />
                  </div>
                )}

                {run.kind === "scenario" && (run.opening?.length > 0 || run.years?.length > 0) && (
                  <div className="mt-8">
                    <ScenarioView run={run} />
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} freeLimit={entitlement?.free_limit || 5} />
    </Layout>
  );
}

// --------------------------------------------------------------------------- //
// Sub-components                                                              //
// --------------------------------------------------------------------------- //

function Header({ entitlement }) {
  return (
    <div className="border-b pb-8" style={{ borderColor: `${t.accent}33` }} data-testid="warroom-header">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="smallcaps" style={{ color: t.accent }}>
          Amygdala — threat detection
        </p>
        {entitlement && !entitlement.is_member && (
          <span className="smallcaps tabular text-ash">
            {entitlement.free_remaining} of {entitlement.free_limit} free verdicts left
          </span>
        )}
      </div>
      <h1 className="cortex-display mt-2 text-5xl tracking-tight md:text-6xl" style={{ fontWeight: 700, color: "#F5F2EC" }}>
        The War Room
      </h1>
      <p className="cortex-editorial mt-3 max-w-3xl text-base text-bone/80 md:text-lg">
        The day's news, stripped of everyone's framing and reduced to what can actually be established — then
        handed to five commanders who between them took, held, saved or lost more ground than anyone in
        history. They will not agree. That is the point.
      </p>
    </div>
  );
}

function BoardRoster({ teams = [] }) {
  // Once the rosters load, each commander is shown with the two consuls he
  // would seat; until then, the leaders alone.
  if (teams.length > 0) {
    return (
      <div data-testid="warroom-roster">
        <p className="smallcaps" style={{ color: t.accent }}>
          Seated at the table
        </p>
        <p className="cortex-editorial mt-1 text-xs text-bone/55">
          Each commander with the two consuls he would pick. Open one to see why.
        </p>
        <div className="mt-4 space-y-3">
          {teams.map((team) => (
            <TeamRoster key={team.id} team={team} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="warroom-roster">
      <p className="smallcaps" style={{ color: t.accent }}>
        Seated at the table
      </p>
      <ul className="mt-4 space-y-3">
        {BOARD_ORDER.map((name) => {
          const meta = MEMBER_META[name];
          return (
            <li
              key={name}
              className="flex items-center gap-4 border px-4 py-3"
              style={{ borderColor: "#2A2A36", borderRadius: 2, background: "rgba(20,20,28,0.5)" }}
            >
              <span style={{ color: t.accent }}>
                <Glyph name={meta.glyph} size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="cortex-display text-[0.98rem] text-pearl" style={{ fontWeight: 600 }}>
                    {name}
                  </span>
                  <span className="smallcaps tabular text-ash" style={{ fontSize: "0.62rem" }}>
                    {meta.dates}
                  </span>
                </div>
                <p className="smallcaps text-ash">{meta.doctrine}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SourceRegistry({ registry }) {
  const [open, setOpen] = useState(false);
  if (!registry) return null;
  const feeds = registry.feeds || [];
  const stateFeeds = registry.state_feeds || [];

  return (
    <div className="mt-8" data-testid="warroom-source-registry">
      <button onClick={() => setOpen((o) => !o)} className="smallcaps text-ash transition-colors hover:text-bone">
        {open ? "− Where the facts come from" : "+ Where the facts come from"}
      </button>
      {open && (
        <div className="mt-4 border p-4" style={{ borderColor: "#2A2A36", borderRadius: 2 }}>
          {!registry.live_enabled && (
            <p className="cortex-editorial mb-3 text-xs italic" style={{ color: "#D08C7A" }}>
              Live pulling is disabled on this deployment — paste your own material instead.
            </p>
          )}
          <p className="smallcaps text-ash">Topic search</p>
          <p className="cortex-editorial mt-1 text-xs leading-relaxed text-bone/70">
            {registry.search?.[0]?.note}
          </p>
          <p className="smallcaps mt-4 text-ash">Standing feeds</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {feeds.map((f) => (
              <span key={f.outlet} className="flex items-center gap-1.5">
                <LeanChip lean={f.lean} />
                <span className="cortex-editorial text-xs text-bone/60">{f.outlet}</span>
              </span>
            ))}
          </div>
          {stateFeeds.length > 0 && (
            <>
              <p className="smallcaps mt-4 text-ash">State media — off unless requested</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stateFeeds.map((f) => (
                  <span key={f.outlet} className="flex items-center gap-1.5">
                    <LeanChip lean={f.lean} />
                    <span className="cortex-editorial text-xs text-bone/60">{f.outlet}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <p className="cortex-editorial mt-4 text-xs leading-relaxed text-ash">{registry.note}</p>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, disabled, label, testid }) {
  return (
    <label
      className={`flex items-center gap-2.5 ${disabled ? "opacity-40" : "cursor-pointer"}`}
      data-testid={testid}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative h-5 w-9 border transition-colors"
        style={{
          borderColor: checked ? t.accent : "#2A2A36",
          background: checked ? `${t.accent}33` : "transparent",
          borderRadius: 2,
        }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 transition-all"
          style={{ left: checked ? 18 : 2, background: checked ? t.accent : "#6B6B78", borderRadius: 1 }}
        />
      </button>
      <span className="smallcaps text-bone/75">{label}</span>
    </label>
  );
}

function Working({ messages, testid }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 3200);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mt-20 flex flex-col items-center py-16"
      data-testid={testid}
    >
      <motion.div
        className="h-px w-56"
        style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
        animate={{ opacity: [0.25, 1, 0.25], scaleX: [0.85, 1, 0.85] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.5 }}
          className="cortex-display mt-7 text-xl italic text-bone/80"
        >
          {messages[i]}
        </motion.p>
      </AnimatePresence>
      <p className="smallcaps mt-4 text-ash">This takes a minute. It is reading everything.</p>
    </motion.div>
  );
}

function RunProgress({ run }) {
  const { stage = "", year, total } = run.progress || {};
  const label =
    {
      queued: "Seating the teams.",
      projection: "The teams are drawing their projections.",
      comparison: "Reading the projections against each other.",
      opening: "The councils are setting their objectives.",
      opening_done: "Objectives set. Year one begins.",
      debrief: "Writing the debrief.",
    }[stage] ||
    (stage === "year" || stage === "year_done"
      ? `Playing year ${year} of ${total}.`
      : "Working.");

  const done = run.kind === "projection" ? (run.projections?.length || 0) : (run.years?.length || 0);
  const outOf = run.kind === "projection" ? 5 : run.horizon || total || 5;
  const pct = Math.min(100, Math.round((done / Math.max(1, outOf)) * 100));

  return (
    <div data-testid="run-progress">
      <div className="flex items-baseline justify-between gap-3">
        <p className="cortex-display text-lg italic text-bone/80">{label}</p>
        <span className="smallcaps tabular text-ash">
          {done} / {outOf}
        </span>
      </div>
      <div className="mt-3 h-px w-full" style={{ background: "#2A2A36" }}>
        <motion.div
          className="h-px"
          style={{ background: t.accent }}
          animate={{ width: `${Math.max(4, pct)}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <p className="smallcaps mt-3 text-ash">
        This runs a call per stage — several minutes. Results appear as they land; you can leave the tab open.
      </p>
    </div>
  );
}

function MapAtmosphere({ grid }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[820px] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${grid})`,
          backgroundRepeat: "repeat",
          backgroundSize: "120px 120px",
          opacity: 0.09,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(30,42,51,0.85), transparent 60%), linear-gradient(180deg, transparent 55%, #0A0A0F 100%)",
        }}
      />
    </div>
  );
}

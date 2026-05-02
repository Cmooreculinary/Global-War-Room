// CourtPage — the cinematic courtroom: a long mahogany bench at the head with
// the historical experts seated as plaques; a gallery of seats for invited
// human witnesses; deliberation transcript types out across the screen; the
// bailiff calls for objections; if anyone objects, the court hears them and
// issues an amended verdict.
//
// URL: /court/:sessionId
//
// Polling-based; no websockets. The session document carries all state.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import { Glyph } from "@/components/Glyphs";
import { CHAMBER_THEME } from "@/lib/chambers";
import {
  beginCourt,
  closeCourt,
  fetchCourtSession,
  joinCourtSession,
  objectInCourt,
} from "@/lib/api";
import { getCourtSeat, saveCourtSeat } from "@/lib/storage";

const POLL_MS = 2200;

export default function CourtPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [seat, setSeat] = useState(() => getCourtSeat(sessionId));
  const [loadError, setLoadError] = useState("");
  const lastVerdictRef = useRef(null);

  // Poll session state
  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      try {
        const s = await fetchCourtSession(sessionId);
        if (!alive) return;
        setSession(s);
      } catch (e) {
        if (!alive) return;
        setLoadError(e?.response?.data?.detail || "Could not reach the court.");
      } finally {
        if (alive) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  const isHost = !!seat?.isHost && session?.attendees?.some(
    (a) => a.id === seat.attendeeId && a.is_host
  );
  const myAttendee = useMemo(
    () => session?.attendees?.find((a) => a.id === seat?.attendeeId) || null,
    [session, seat]
  );

  // Handle joining the court
  const handleJoin = useCallback(async (name) => {
    try {
      const { attendee_id } = await joinCourtSession(sessionId, name);
      const newSeat = { attendeeId: attendee_id, name, isHost: false };
      saveCourtSeat(sessionId, newSeat);
      setSeat(newSeat);
      // Refresh session so attendee shows immediately
      const s = await fetchCourtSession(sessionId);
      setSession(s);
      toast.success(`Seated, ${name}.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not seat you in this court.");
    }
  }, [sessionId]);

  const handleBegin = useCallback(async () => {
    if (!seat?.attendeeId) return;
    try {
      await beginCourt(sessionId, seat.attendeeId);
      toast.success("The court is in session.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not convene the court.");
    }
  }, [sessionId, seat]);

  const handleObject = useCallback(async ({ name, content }) => {
    if (!seat?.attendeeId) return;
    try {
      await objectInCourt(sessionId, { attendeeId: seat.attendeeId, name, content });
      toast.success("Objection entered. The court is reconsidering.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not enter your objection.");
    }
  }, [sessionId, seat]);

  const handleClose = useCallback(async () => {
    if (!seat?.attendeeId) return;
    try {
      await closeCourt(sessionId, seat.attendeeId);
      toast.success("The court is adjourned.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not adjourn the court.");
    }
  }, [sessionId, seat]);

  if (loadError && !session) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl px-6 py-24 text-center" data-testid="court-error">
          <p className="smallcaps text-ash">The clerk's office</p>
          <h2 className="cortex-display mt-3 text-3xl text-pearl italic">{loadError}</h2>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl px-6 py-24 text-center" data-testid="court-loading">
          <p className="smallcaps text-ash animate-pulse">Approaching the bench…</p>
        </div>
      </Layout>
    );
  }

  // If we don't have a seat yet, show join form
  if (!seat) {
    return (
      <Layout accentChamber={session.chamber_id}>
        <CourtroomBackdrop chamberId={session.chamber_id} />
        <JoinTheCourt session={session} onJoin={handleJoin} />
      </Layout>
    );
  }

  return (
    <Layout accentChamber={session.chamber_id}>
      <CourtroomBackdrop chamberId={session.chamber_id} />
      <div className="relative mx-auto max-w-7xl px-4 pb-32 pt-12 md:px-8 md:pt-16">
        <CaseHeader session={session} />
        <Bench session={session} />
        <Gallery session={session} myAttendeeId={myAttendee?.id} />

        <SessionStage
          session={session}
          isHost={isHost}
          mySeat={seat}
          lastVerdictRef={lastVerdictRef}
          onBegin={handleBegin}
          onObject={handleObject}
          onClose={handleClose}
        />
      </div>
    </Layout>
  );
}

// --------------------------------------------------------------------------- //
// Backdrop & framing                                                          //
// --------------------------------------------------------------------------- //

function CourtroomBackdrop({ chamberId }) {
  const t = CHAMBER_THEME[chamberId] || CHAMBER_THEME.senate;
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden
      data-testid="courtroom-backdrop"
    >
      {/* Mahogany base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #2A1810 0%, #160B07 55%, #0A0606 100%)",
        }}
      />
      {/* Cathedral light from above */}
      <div
        className="absolute inset-x-0 top-0 h-1/2"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${t.glowRgba}, transparent 65%)`,
        }}
      />
      {/* Wood grain — diagonal noise */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(105deg, rgba(120,70,40,0.4) 0px, rgba(60,30,15,0.0) 2px, rgba(120,70,40,0.3) 4px, rgba(60,30,15,0.0) 8px)",
        }}
      />
      {/* Dust motes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 25% 60%, rgba(255,229,180,0.05), transparent 30%), radial-gradient(circle at 75% 70%, rgba(255,229,180,0.04), transparent 30%)",
        }}
      />
    </div>
  );
}

function CaseHeader({ session }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  return (
    <header className="text-center" data-testid="court-case-header">
      <p className="smallcaps text-ash">In the matter before</p>
      <h1
        className="cortex-display mt-2 text-3xl tracking-tight text-pearl md:text-5xl"
        style={{ color: t.accent, fontWeight: 700 }}
      >
        {t.name}
      </h1>
      <p className="cortex-display mx-auto mt-6 max-w-3xl text-xl italic text-bone md:text-2xl leading-snug">
        “{session.question}”
      </p>
      <StatusBadge status={session.status} accent={t.accent} />
    </header>
  );
}

function StatusBadge({ status, accent }) {
  const map = {
    open: "Court awaiting convening",
    deliberating: "The bench is deliberating",
    objection_window: "The bailiff calls for objections",
    objection: "An objection is heard",
    amended: "Amended verdict entered",
    closed: "Court adjourned",
    error: "The court has paused",
  };
  return (
    <p
      className="smallcaps mt-6 inline-block border-b pb-1"
      style={{ color: accent, borderColor: accent + "55" }}
      data-testid="court-status"
    >
      {map[status] || status}
    </p>
  );
}

// --------------------------------------------------------------------------- //
// Bench — the panel of experts at the table                                   //
// --------------------------------------------------------------------------- //

function Bench({ session }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  const speaking = currentlySpeakingMember(session);
  return (
    <section className="mt-14 md:mt-20" data-testid="court-bench">
      <p className="smallcaps text-center text-ash mb-6">The bench</p>
      <div
        className="relative mx-auto flex max-w-5xl flex-wrap items-end justify-center gap-5 border-b-2 pb-4"
        style={{
          borderColor: t.accent + "66",
          boxShadow: `0 16px 50px ${t.glowRgba}`,
        }}
      >
        {(session.panel || []).map((m) => (
          <ExpertPlaque
            key={m.name}
            member={m}
            theme={t}
            speaking={speaking === m.name}
          />
        ))}
      </div>
      {/* The wood of the table */}
      <div
        className="mx-auto h-3 max-w-5xl"
        style={{
          background:
            "linear-gradient(180deg, #4A2818 0%, #2A1810 60%, #160B07 100%)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
        }}
      />
    </section>
  );
}

function ExpertPlaque({ member, theme, speaking }) {
  return (
    <motion.div
      data-testid={`expert-plaque-${member.name?.replace(/\s+/g, "-").toLowerCase()}`}
      className="relative flex w-44 flex-col items-center border bg-carbon/70 px-3 py-4 text-center"
      style={{
        borderColor: speaking ? theme.accent : theme.accent + "44",
        borderRadius: 2,
        boxShadow: speaking
          ? `0 0 38px ${theme.glowRgba}, inset 0 0 18px ${theme.glowRgba}`
          : "0 4px 18px rgba(0,0,0,0.5)",
      }}
      animate={
        speaking
          ? { y: [0, -3, 0] }
          : { y: 0 }
      }
      transition={{ duration: 1.6, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center border"
        style={{
          borderColor: theme.accent + "77",
          color: theme.accent,
          borderRadius: 999,
        }}
      >
        <Glyph name={member.glyph || "laurel"} size={20} />
      </div>
      <p
        className="cortex-display mt-2 text-base italic"
        style={{ color: speaking ? "#FFE5B4" : "#F5F2EC", fontWeight: 600 }}
      >
        {member.name}
      </p>
      {member.dates && (
        <p className="smallcaps mt-0.5 tabular text-ash">{member.dates}</p>
      )}
      <p
        className="cortex-editorial mt-1 text-[0.72rem] italic"
        style={{ color: theme.accent, opacity: 0.85 }}
      >
        {member.lineage}
      </p>
    </motion.div>
  );
}

function currentlySpeakingMember(session) {
  // Highlight the latest deliberation entry while typing in.
  if (!session?.deliberation || session.deliberation.length === 0) return null;
  if (session.status !== "deliberating" && session.status !== "objection_window") return null;
  return session.deliberation[session.deliberation.length - 1]?.member || null;
}

// --------------------------------------------------------------------------- //
// Gallery — the seats for human witnesses                                     //
// --------------------------------------------------------------------------- //

function Gallery({ session, myAttendeeId }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  const attendees = session.attendees || [];
  return (
    <section className="mt-14" data-testid="court-gallery">
      <p className="smallcaps text-center text-ash mb-5">The gallery</p>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
        {attendees.map((a) => (
          <div
            key={a.id}
            className="cortex-ui inline-flex items-center gap-2 border px-3 py-2 text-sm"
            style={{
              borderColor: a.id === myAttendeeId ? t.accent : "#2A2A36",
              borderRadius: 2,
              color: a.is_host ? t.accent : "#F5F2EC",
              background: a.id === myAttendeeId ? `${t.primary}1A` : "rgba(20,20,28,0.7)",
            }}
            data-testid={`attendee-${a.id}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: a.is_host ? t.accent : "#6B6B78" }}
            />
            {a.name}
            {a.is_host && <span className="smallcaps ml-1 text-xs">Host</span>}
            {a.id === myAttendeeId && !a.is_host && <span className="smallcaps ml-1 text-xs">You</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// SessionStage — the dynamic middle: deliberation transcript / verdict /      //
// bailiff prompt / objection form / amended verdict.                          //
// --------------------------------------------------------------------------- //

function SessionStage({ session, isHost, mySeat, lastVerdictRef, onBegin, onObject, onClose }) {
  const status = session.status;
  return (
    <div className="mt-16">
      {status === "open" && (
        <BeforeConvening session={session} isHost={isHost} mySeat={mySeat} onBegin={onBegin} />
      )}

      {(status === "deliberating" ||
        status === "objection_window" ||
        status === "objection" ||
        status === "amended" ||
        status === "closed") && (
        <Transcript session={session} />
      )}

      {(status === "objection_window" || status === "objection" || status === "amended" || status === "closed") &&
        session.verdict && (
          <VerdictBlock
            ref={lastVerdictRef}
            session={session}
            label="Verdict of the court"
            text={session.verdict}
            stamped={status !== "objection_window"}
          />
        )}

      {status === "objection_window" && (
        <BailiffPrompt
          session={session}
          mySeat={mySeat}
          isHost={isHost}
          onObject={onObject}
          onClose={onClose}
        />
      )}

      {status === "objection" && <ObjectionInProgress session={session} />}

      {(status === "amended" || (status === "closed" && session.amended_verdict)) && (
        <VerdictBlock
          session={session}
          label={`Amended ruling — moved by ${session.objection?.by_name || "a witness"}`}
          text={session.amended_verdict}
          stamped
          amended
        />
      )}

      {(status === "amended" || status === "closed") && session.objection && (
        <ObjectionRecord objection={session.objection} chamberId={session.chamber_id} />
      )}

      {status === "amended" && isHost && (
        <div className="mt-12 text-center">
          <button
            onClick={onClose}
            className="cortex-ui inline-flex items-center gap-2 border border-slate px-6 py-2.5 text-sm text-bone hover:border-bone/40 transition-colors"
            data-testid="court-close-button"
          >
            Adjourn the court
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="mt-10 text-center">
          <p className="cortex-editorial text-bone/70 italic">
            The court has paused. Please try again later.
          </p>
        </div>
      )}
    </div>
  );
}

function BeforeConvening({ session, isHost, mySeat, onBegin }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  const shareUrl = `${window.location.origin}/court/${session.id}`;
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied — invite your witnesses.");
    } catch {
      toast.message(shareUrl);
    }
  };
  return (
    <div className="mx-auto mt-4 max-w-2xl text-center" data-testid="court-before-convening">
      <p className="cortex-editorial text-bone/80 italic">
        The bench is seated. Witnesses are arriving in the gallery.
        {isHost ? " When you are ready, convene the court." : " The host will convene shortly."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={copyShare}
          className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm text-bone hover:bg-carbon/40 transition-colors"
          style={{ borderColor: t.accent, borderRadius: 2 }}
          data-testid="court-share-button"
        >
          Copy invitation link
        </button>
        {isHost && mySeat && (
          <button
            onClick={onBegin}
            className="cortex-ui inline-flex items-center gap-3 border px-7 py-3 transition-all duration-300"
            style={{
              borderColor: t.accent,
              color: "#F5F2EC",
              backgroundColor: `${t.primary}33`,
              borderRadius: 2,
            }}
            data-testid="court-begin-button"
          >
            Convene the court
          </button>
        )}
      </div>
    </div>
  );
}

function Transcript({ session }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  return (
    <section className="mx-auto mt-14 max-w-3xl" data-testid="court-transcript">
      <p className="smallcaps text-center text-ash">The record</p>
      <div className="mt-6 space-y-5">
        <AnimatePresence initial={false}>
          {(session.deliberation || []).map((d, i) => (
            <TranscriptLine
              key={`${d.member}-${i}`}
              d={d}
              accent={t.accent}
              i={i}
            />
          ))}
        </AnimatePresence>
        {session.status === "deliberating" && (
          <p className="smallcaps text-center text-ash mt-6 animate-pulse" data-testid="transcript-pending">
            The bench is speaking on the record…
          </p>
        )}
      </div>
    </section>
  );
}

function TranscriptLine({ d, accent, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(i * 0.06, 0.4) }}
      className="border-l-2 pl-5 md:pl-6"
      style={{ borderColor: d.dissent ? "#8B1A1A" : accent }}
      data-testid={`transcript-line-${i}`}
    >
      <div className="flex items-baseline gap-3">
        <p
          className="cortex-display text-lg italic"
          style={{ color: accent, fontWeight: 600 }}
        >
          {d.member}
        </p>
        {d.dissent && (
          <span className="smallcaps text-[#E89A9A]">Dissent</span>
        )}
      </div>
      <p className="cortex-editorial mt-1 text-bone/90 leading-relaxed">{d.contribution}</p>
    </motion.div>
  );
}

const VerdictBlock = React.forwardRef(function VerdictBlock(
  { session, label, text, stamped, amended },
  ref
) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="mx-auto mt-16 max-w-3xl"
      data-testid={amended ? "amended-verdict" : "verdict-block"}
    >
      <div className="hairline mb-6" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}88, transparent)` }} />
      <p className="smallcaps text-center" style={{ color: t.accent }}>
        {label}
      </p>
      <div
        className="cortex-editorial dropcap mt-5 text-[1.12rem] leading-[1.85] text-bone"
        style={{ "--cap-color": t.accent }}
      >
        {text}
      </div>
      {stamped && (
        <CourtSeal accent={t.accent} amended={amended} />
      )}
    </motion.section>
  );
});

function CourtSeal({ accent, amended }) {
  return (
    <div className="mt-8 flex justify-center" aria-hidden>
      <motion.div
        initial={{ scale: 1.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 0.9, rotate: -6 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="flex h-24 w-24 items-center justify-center rounded-full border-2"
        style={{
          borderColor: accent,
          color: accent,
          boxShadow: `0 0 30px ${accent}55`,
        }}
      >
        <span className="cortex-display italic text-center text-[0.7rem] leading-tight" style={{ fontWeight: 700 }}>
          {amended ? (
            <>AMENDED<br />ON THE<br />RECORD</>
          ) : (
            <>ENTERED<br />ON THE<br />RECORD</>
          )}
        </span>
      </motion.div>
    </div>
  );
}

function BailiffPrompt({ session, mySeat, isHost, onObject, onClose }) {
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [name, setName] = useState(mySeat?.name || "");
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;

  const submit = async () => {
    const c = content.trim();
    if (!c) return;
    await onObject({ name: name.trim() || mySeat?.name || "A witness", content: c });
    setShowForm(false);
    setContent("");
  };

  return (
    <section className="mx-auto mt-12 max-w-3xl text-center" data-testid="bailiff-prompt">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="cortex-display italic text-2xl text-pearl md:text-3xl"
      >
        “Does anyone object to the verdict of this court?”
      </motion.p>
      <p className="smallcaps mt-2 text-ash">— the bailiff</p>

      {!showForm && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => setShowForm(true)}
            className="cortex-ui inline-flex items-center gap-2 border px-6 py-3 text-sm transition-colors hover:bg-carbon/40"
            style={{ borderColor: "#8B1A1A", color: "#FFE5B4", borderRadius: 2 }}
            data-testid="object-button"
          >
            I object
          </button>
          {isHost && (
            <button
              onClick={onClose}
              className="cortex-ui inline-flex items-center gap-2 border border-slate px-6 py-3 text-sm text-bone hover:border-bone/40 transition-colors"
              data-testid="court-close-button"
            >
              Hearing nothing — adjourn the court
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="mx-auto mt-8 max-w-xl border bg-carbon/80 p-6 text-left"
            style={{ borderColor: t.accent + "77", borderRadius: 2 }}
            data-testid="objection-form"
          >
            <p className="smallcaps text-ash">Approach the bench</p>
            <p className="cortex-display italic mt-1 text-xl text-pearl">
              State your objection for the record.
            </p>
            <input
              data-testid="objection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-4 block w-full border bg-transparent px-4 py-2.5 text-bone placeholder:text-ash cortex-ui text-sm focus:outline-none"
              style={{ borderColor: "#2A2A36", borderRadius: 2 }}
            />
            <textarea
              data-testid="objection-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Make your case…"
              rows={5}
              className="mt-3 block w-full border bg-transparent px-4 py-3 text-bone placeholder:text-ash cortex-editorial text-[1rem] leading-relaxed focus:outline-none"
              style={{ borderColor: "#2A2A36", borderRadius: 2 }}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="smallcaps text-ash hover:text-bone transition-colors"
                data-testid="objection-cancel"
              >
                Stand down
              </button>
              <button
                onClick={submit}
                disabled={!content.trim()}
                className="cortex-ui inline-flex items-center gap-2 border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
                style={{
                  borderColor: t.accent,
                  color: "#F5F2EC",
                  backgroundColor: `${t.primary}33`,
                  borderRadius: 2,
                }}
                data-testid="objection-submit"
              >
                Enter objection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ObjectionInProgress({ session }) {
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  return (
    <section className="mx-auto mt-12 max-w-3xl text-center" data-testid="objection-in-progress">
      <p className="smallcaps" style={{ color: t.accent }}>The court is reconsidering</p>
      <p className="cortex-display italic mt-3 text-2xl text-pearl">
        “{session.objection?.by_name}” has approached the bench.
      </p>
      <p className="cortex-editorial mt-3 text-bone/80 italic">
        The chair is weighing the objection.
      </p>
    </section>
  );
}

function ObjectionRecord({ objection, chamberId }) {
  const t = CHAMBER_THEME[chamberId] || CHAMBER_THEME.senate;
  return (
    <section className="mx-auto mt-10 max-w-3xl" data-testid="objection-record">
      <div
        className="border-l-2 pl-5 md:pl-6"
        style={{ borderColor: t.accent + "AA" }}
      >
        <p className="smallcaps text-ash">Objection on the record</p>
        <p className="cortex-display italic mt-2 text-xl text-pearl">{objection.by_name}</p>
        <p className="cortex-editorial mt-2 text-bone/85 leading-relaxed">{objection.content}</p>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// Join form — for arrivals who have a link but no seat yet                    //
// --------------------------------------------------------------------------- //

function JoinTheCourt({ session, onJoin }) {
  const [name, setName] = useState("");
  const t = CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate;
  const submit = (e) => {
    e?.preventDefault?.();
    const n = name.trim();
    if (!n) return;
    onJoin(n);
  };
  return (
    <section
      className="mx-auto mt-24 max-w-xl px-6 text-center"
      data-testid="court-join-form"
    >
      <p className="smallcaps text-ash">A court has been convened</p>
      <h2 className="cortex-display mt-3 text-3xl italic text-pearl md:text-4xl" style={{ color: t.accent }}>
        {(CHAMBER_THEME[session.chamber_id] || CHAMBER_THEME.senate).name}
      </h2>
      <p className="cortex-display italic mt-5 text-xl text-bone leading-snug">
        “{session.question}”
      </p>
      <p className="cortex-editorial italic mt-6 text-bone/80">
        Enter your name to be seated as a witness in the gallery.
      </p>
      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md flex-col gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="block w-full border bg-transparent px-5 py-3 text-bone placeholder:text-ash cortex-editorial text-base focus:outline-none"
          style={{ borderColor: t.accent + "77", borderRadius: 2 }}
          data-testid="join-name-input"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="cortex-ui inline-flex items-center justify-center gap-2 border px-6 py-3 text-sm transition-colors disabled:opacity-40"
          style={{
            borderColor: t.accent,
            color: "#F5F2EC",
            backgroundColor: `${t.primary}33`,
            borderRadius: 2,
          }}
          data-testid="join-submit"
        >
          Take a seat in the gallery
        </button>
      </form>
    </section>
  );
}

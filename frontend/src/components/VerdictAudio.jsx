// VerdictAudio — multi-voice playback orchestrator.
//
// Builds an ordered queue of {text, chamber_id, label} segments and plays them
// through one <audio> element. Each segment gets its own chamber voice via
// /api/speak. Behaviour:
//   - Single-chamber verdict → all deliberation members + verdict in chair voice.
//   - Committee verdict → each witness in its OWN chamber voice, then the chair
//     reads the synthesized verdict last.
//
// Playback lifecycle + blob URL cache live in `useAudioPlayer`.
import React, { useMemo } from "react";
import { motion } from "framer-motion";

import { CHAMBER_THEME } from "@/lib/chambers";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

const NAME_TO_ID = {
  "The Senate": "senate",
  "The Boardroom": "boardroom",
  "The Court Room": "courtroom",
  "The Council": "council",
  "The Forge": "forge",
};

function buildSegments(verdict) {
  const segments = [];
  const chairId = verdict.chamber_id;
  const isCommittee =
    verdict.committee &&
    Array.isArray(verdict.witnesses_called) &&
    verdict.witnesses_called.length > 1;

  for (const d of verdict.deliberation || []) {
    const witnessChamber = isCommittee ? NAME_TO_ID[d.member] || chairId : chairId;
    segments.push({
      text: `${d.member}. ${d.contribution}`,
      chamberId: witnessChamber,
      label: d.member,
    });
  }
  segments.push({
    text: `The verdict. ${verdict.verdict}`,
    chamberId: chairId,
    label: `${verdict.chamber} — verdict`,
  });
  return segments;
}

export default function VerdictAudio({ verdict }) {
  const segments = useMemo(() => buildSegments(verdict), [verdict]);
  const { playing, activeIdx, loadingIdx, togglePlayPause, restart } = useAudioPlayer(
    segments,
    verdict?.id
  );

  const chairTheme = CHAMBER_THEME[verdict.chamber_id] || CHAMBER_THEME.senate;
  const currentLabel =
    activeIdx >= 0 && segments[activeIdx] ? segments[activeIdx].label : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3" data-testid="verdict-audio">
      <PlayPauseButton
        playing={playing}
        activeIdx={activeIdx}
        loadingIdx={loadingIdx}
        chairTheme={chairTheme}
        onClick={togglePlayPause}
      />

      {activeIdx >= 0 && (
        <button
          type="button"
          onClick={restart}
          className="smallcaps text-ash hover:text-bone transition-colors"
          data-testid="verdict-audio-restart"
        >
          Restart
        </button>
      )}

      {currentLabel && (
        <NowPlayingLabel
          playing={playing}
          accent={chairTheme.accent}
          label={currentLabel}
          activeIdx={activeIdx}
          total={segments.length}
        />
      )}
    </div>
  );
}

function PlayPauseButton({ playing, activeIdx, loadingIdx, chairTheme, onClick }) {
  const buttonText =
    loadingIdx >= 0
      ? "Loading…"
      : playing
      ? "Pause"
      : activeIdx >= 0
      ? "Resume"
      : "Listen to the verdict";
  return (
    <button
      type="button"
      onClick={onClick}
      className="cortex-ui inline-flex items-center gap-3 border px-5 py-2.5 text-sm transition-colors"
      style={{
        borderColor: chairTheme.accent,
        color: "#F5F2EC",
        background: playing ? `${chairTheme.primary}22` : "transparent",
        borderRadius: 2,
      }}
      data-testid="verdict-audio-play"
      aria-label={playing ? "Pause" : "Listen to the verdict"}
    >
      <motion.span
        aria-hidden
        className="inline-flex"
        animate={playing ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
        transition={{ duration: 1.4, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </motion.span>
      <span>{buttonText}</span>
    </button>
  );
}

function NowPlayingLabel({ playing, accent, label, activeIdx, total }) {
  return (
    <span
      className="cortex-editorial italic text-sm text-bone/65"
      data-testid="verdict-audio-now-playing"
    >
      {playing ? "Now reading: " : "Paused at: "}
      <span style={{ color: accent }}>{label}</span>
      <span className="ml-2 smallcaps tabular text-ash">
        {Math.min(activeIdx + 1, total)} / {total}
      </span>
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M3 2 L 12 7 L 3 12 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <rect x="3" y="2" width="3" height="10" />
      <rect x="8" y="2" width="3" height="10" />
    </svg>
  );
}

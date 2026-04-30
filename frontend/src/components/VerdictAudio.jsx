// VerdictAudio — multi-voice playback orchestrator.
//
// Builds an ordered queue of {text, chamber_id, label} segments and plays them
// through one <audio> element. Each segment gets its own chamber voice via
// /api/speak. Behaviour:
//   - Single-chamber verdict → all deliberation members + verdict in chair voice.
//   - Committee verdict → each witness in its OWN chamber voice, then the chair
//     reads the synthesized verdict last.
//
// Caches blob URLs so replay doesn't re-fetch from OpenAI.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { CHAMBER_THEME } from "@/lib/chambers";
import { speakAudioUrl } from "@/lib/api";

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
  const isCommittee = verdict.committee && Array.isArray(verdict.witnesses_called) && verdict.witnesses_called.length > 1;

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
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1); // -1 = not started
  const [loadingIdx, setLoadingIdx] = useState(-1);
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map()); // idx -> blob url
  const stoppedRef = useRef(false);

  // Setup audio element on mount
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      // Revoke any cached blob URLs
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current.clear();
    };
  }, []);

  // Reset cache when verdict changes
  useEffect(() => {
    stop();
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    cacheRef.current.clear();
    setActiveIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict?.id]);

  const fetchSegment = async (idx) => {
    if (cacheRef.current.has(idx)) return cacheRef.current.get(idx);
    const seg = segments[idx];
    const url = await speakAudioUrl(seg.text, seg.chamberId);
    cacheRef.current.set(idx, url);
    return url;
  };

  const playFrom = async (startIdx) => {
    if (!audioRef.current) return;
    stoppedRef.current = false;
    setPlaying(true);
    let idx = startIdx;
    while (idx < segments.length && !stoppedRef.current) {
      try {
        setLoadingIdx(idx);
        const url = await fetchSegment(idx);
        if (stoppedRef.current) return;
        setLoadingIdx(-1);
        setActiveIdx(idx);
        audioRef.current.src = url;
        // Begin pre-fetching next segment in parallel.
        if (idx + 1 < segments.length && !cacheRef.current.has(idx + 1)) {
          fetchSegment(idx + 1).catch(() => {});
        }
        await playUntilEnd(audioRef.current);
        if (stoppedRef.current) return;
        idx += 1;
      } catch (e) {
        toast.error("Playback failed. Try again.");
        break;
      }
    }
    if (!stoppedRef.current) {
      // Finished naturally
      setPlaying(false);
      setActiveIdx(-1);
    }
  };

  const playUntilEnd = (audio) =>
    new Promise((resolve, reject) => {
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = (e) => {
        cleanup();
        reject(e);
      };
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      audio.play().catch(reject);
    });

  const stop = () => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaying(false);
    setLoadingIdx(-1);
  };

  const onPlayPause = () => {
    if (playing) {
      // pause without losing position
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlaying(false);
      } else if (audioRef.current && audioRef.current.paused && activeIdx >= 0) {
        audioRef.current.play();
        setPlaying(true);
      }
    } else {
      // start or resume
      if (activeIdx < 0) {
        playFrom(0);
      } else if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play();
        setPlaying(true);
      } else {
        playFrom(activeIdx);
      }
    }
  };

  const onRestart = () => {
    stop();
    setActiveIdx(-1);
    setTimeout(() => playFrom(0), 50);
  };

  const chairTheme = CHAMBER_THEME[verdict.chamber_id] || CHAMBER_THEME.senate;
  const currentLabel =
    activeIdx >= 0 && segments[activeIdx] ? segments[activeIdx].label : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3" data-testid="verdict-audio">
      <button
        type="button"
        onClick={onPlayPause}
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
        <span>
          {loadingIdx >= 0
            ? "Loading…"
            : playing
            ? "Pause"
            : activeIdx >= 0
            ? "Resume"
            : "Listen to the verdict"}
        </span>
      </button>

      {activeIdx >= 0 && (
        <button
          type="button"
          onClick={onRestart}
          className="smallcaps text-ash hover:text-bone transition-colors"
          data-testid="verdict-audio-restart"
        >
          Restart
        </button>
      )}

      {currentLabel && (
        <span
          className="cortex-editorial italic text-sm text-bone/65"
          data-testid="verdict-audio-now-playing"
        >
          {playing ? "Now reading: " : "Paused at: "}
          <span style={{ color: chairTheme.accent }}>{currentLabel}</span>
          <span className="ml-2 smallcaps tabular text-ash">
            {Math.min(activeIdx + 1, segments.length)} / {segments.length}
          </span>
        </span>
      )}
    </div>
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

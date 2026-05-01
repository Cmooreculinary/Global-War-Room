// useAudioPlayer — sequenced multi-segment audio playback with blob caching.
// Owns the <Audio> element, blob URL cache, and play/pause/restart state.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { speakAudioUrl } from "@/lib/api";

export function useAudioPlayer(segments, resetKey) {
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1); // -1 = not started
  const [loadingIdx, setLoadingIdx] = useState(-1);
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map()); // idx -> blob url
  const stoppedRef = useRef(false);

  // Setup audio element on mount; tear down on unmount.
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    const cache = cacheRef.current;
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
    setLoadingIdx(-1);
  }, []);

  // Reset cache + state when verdict changes.
  useEffect(() => {
    stop();
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    cacheRef.current.clear();
    setActiveIdx(-1);
  }, [resetKey, stop]);

  const fetchSegment = useCallback(
    async (idx) => {
      if (cacheRef.current.has(idx)) return cacheRef.current.get(idx);
      const seg = segments[idx];
      const url = await speakAudioUrl(seg.text, seg.chamberId);
      cacheRef.current.set(idx, url);
      return url;
    },
    [segments]
  );

  const playFrom = useCallback(
    async (startIdx) => {
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
        } catch {
          toast.error("Playback failed. Try again.");
          break;
        }
      }
      if (!stoppedRef.current) {
        setPlaying(false);
        setActiveIdx(-1);
      }
    },
    [segments, fetchSegment]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      if (!audio.paused) {
        audio.pause();
        setPlaying(false);
      }
      return;
    }
    if (activeIdx < 0) {
      playFrom(0);
    } else if (audio.paused) {
      audio.play();
      setPlaying(true);
    } else {
      playFrom(activeIdx);
    }
  }, [playing, activeIdx, playFrom]);

  const restart = useCallback(() => {
    stop();
    setActiveIdx(-1);
    setTimeout(() => playFrom(0), 50);
  }, [stop, playFrom]);

  return { playing, activeIdx, loadingIdx, togglePlayPause, restart };
}

function playUntilEnd(audio) {
  return new Promise((resolve, reject) => {
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
}

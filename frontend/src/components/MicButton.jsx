// MicButton — push-once-to-record / push-again-to-stop microphone control.
// Records via MediaRecorder, sends to /api/transcribe, calls onTranscribed(text).
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { transcribeAudio } from "@/lib/api";

const STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
};

// Pick a MIME type the browser supports.
function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

export default function MicButton({ onTranscribed, disabled = false }) {
  const [state, setState] = useState(STATE.IDLE);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const tickRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    if (typeof MediaRecorder === "undefined") {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 800) {
          // Too short — Whisper will reject empty audio.
          setState(STATE.IDLE);
          setElapsed(0);
          toast.message("Hold the mic a moment longer.");
          return;
        }
        setState(STATE.TRANSCRIBING);
        try {
          const ext = (mime && mime.includes("mp4")) ? "m4a" : "webm";
          const { text } = await transcribeAudio(blob, `recording.${ext}`);
          if (text && text.trim()) {
            onTranscribed(text.trim());
          } else {
            toast.message("Nothing transcribable was heard. Try again.");
          }
        } catch (e) {
          toast.error("Transcription failed. Try again.");
        } finally {
          setState(STATE.IDLE);
          setElapsed(0);
        }
      };

      recorder.start();
      const start = Date.now();
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 250);
      setState(STATE.RECORDING);
    } catch (e) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Could not start recording.";
      toast.error(msg);
      stopStream();
      setState(STATE.IDLE);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    } else {
      stopStream();
      setState(STATE.IDLE);
      setElapsed(0);
    }
  };

  const handleClick = () => {
    if (state === STATE.RECORDING) stopRecording();
    else if (state === STATE.IDLE) startRecording();
  };

  const isRecording = state === STATE.RECORDING;
  const isTranscribing = state === STATE.TRANSCRIBING;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      data-testid="mic-button"
      className="cortex-ui inline-flex items-center gap-3 border px-5 py-3 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: isRecording ? "#C84A1F" : "#2A2A36",
        backgroundColor: isRecording ? "rgba(200,74,31,0.18)" : "rgba(20,20,28,0.7)",
        color: isRecording ? "#FFE5B4" : "#E8E4DC",
        borderRadius: 2,
      }}
      aria-label={isRecording ? "Stop recording" : "Speak the question"}
    >
      <motion.span
        aria-hidden
        className="inline-flex h-3 w-3 rounded-full"
        style={{ background: isRecording ? "#FF6B3D" : isTranscribing ? "#C9A961" : "#6B6B78" }}
        animate={
          isRecording
            ? { scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }
            : isTranscribing
            ? { opacity: [0.4, 1, 0.4] }
            : { scale: 1, opacity: 1 }
        }
        transition={{ duration: 1.0, repeat: isRecording || isTranscribing ? Infinity : 0, ease: "easeInOut" }}
      />
      <span className="cortex-ui text-sm tracking-wide" data-testid="mic-button-label">
        {isRecording ? `Recording… ${elapsed}s — click to stop` : isTranscribing ? "Transcribing…" : "Speak the question"}
      </span>
    </button>
  );
}

// MicButton — push-once-to-record / push-again-to-stop microphone control.
// Recording lifecycle lives in `useRecording`; this component renders the button.
import React from "react";
import { motion } from "framer-motion";

import { REC_STATE, useRecording } from "@/hooks/useRecording";

export default function MicButton({ onTranscribed, disabled = false }) {
  const { state, elapsed, start, stop } = useRecording({ onTranscribed });

  const isRecording = state === REC_STATE.RECORDING;
  const isTranscribing = state === REC_STATE.TRANSCRIBING;

  const handleClick = () => {
    if (disabled) return;
    if (isRecording) stop();
    else if (state === REC_STATE.IDLE) start();
  };

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
      <RecordingIndicator isRecording={isRecording} isTranscribing={isTranscribing} />
      <span className="cortex-ui text-sm tracking-wide" data-testid="mic-button-label">
        {isRecording
          ? `Recording… ${elapsed}s — click to stop`
          : isTranscribing
          ? "Transcribing…"
          : "Speak the question"}
      </span>
    </button>
  );
}

function RecordingIndicator({ isRecording, isTranscribing }) {
  const background = isRecording ? "#FF6B3D" : isTranscribing ? "#C9A961" : "#6B6B78";
  const animate = isRecording
    ? { scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }
    : isTranscribing
    ? { opacity: [0.4, 1, 0.4] }
    : { scale: 1, opacity: 1 };
  return (
    <motion.span
      aria-hidden
      className="inline-flex h-3 w-3 rounded-full"
      style={{ background }}
      animate={animate}
      transition={{
        duration: 1.0,
        repeat: isRecording || isTranscribing ? Infinity : 0,
        ease: "easeInOut",
      }}
    />
  );
}

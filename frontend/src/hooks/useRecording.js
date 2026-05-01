// useRecording — encapsulates MediaRecorder lifecycle for voice capture.
// Returns { state, elapsed, start, stop } where state is "idle" | "recording" | "transcribing".
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { transcribeAudio } from "@/lib/api";

export const REC_STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

export function useRecording({ onTranscribed }) {
  const [state, setState] = useState(REC_STATE.IDLE);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const tickRef = useRef(null);

  const stopStream = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const transcribeBlob = useCallback(
    async (blob, mime) => {
      if (blob.size < 800) {
        setState(REC_STATE.IDLE);
        setElapsed(0);
        toast.message("Hold the mic a moment longer.");
        return;
      }
      setState(REC_STATE.TRANSCRIBING);
      try {
        const ext = mime && mime.includes("mp4") ? "m4a" : "webm";
        const { text } = await transcribeAudio(blob, `recording.${ext}`);
        if (text && text.trim()) onTranscribed(text.trim());
        else toast.message("Nothing transcribable was heard. Try again.");
      } catch {
        toast.error("Transcription failed. Try again.");
      } finally {
        setState(REC_STATE.IDLE);
        setElapsed(0);
      }
    },
    [onTranscribed]
  );

  const start = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        chunksRef.current = [];
        await transcribeBlob(blob, mime);
      };

      recorder.start();
      const startTime = Date.now();
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 250);
      setState(REC_STATE.RECORDING);
    } catch (e) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Could not start recording.";
      toast.error(msg);
      stopStream();
      setState(REC_STATE.IDLE);
    }
  }, [stopStream, transcribeBlob]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    } else {
      stopStream();
      setState(REC_STATE.IDLE);
      setElapsed(0);
    }
  }, [stopStream]);

  return { state, elapsed, start, stop };
}

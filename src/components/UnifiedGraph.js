import React, { useRef, useEffect, useState } from "react";
import { detectPitch } from "../utils/pitchDetection";
import { frequencyToNote } from "../utils/noteMapping";

const HISTORY_LENGTH = 600; // how many points we store

function detectHumanPitch(freq) {
  if (!freq || freq <= 0) return 0;

  // Human fundamental vocal range
  const MIN = 75;      // Bass lowest
  const MAX = 1200;    // Soprano highest

  if (freq < MIN || freq > MAX) {
    return 0; // treat as silence, ignored in graph
  }

  return freq;
}

const UnifiedGraph = ({ analyser, audioContext, isActive, sessionId, zoomH }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const historyRef = useRef([]); // [{ midi, freq, rms }]
  const panRef = useRef(0); // 0 = newest at right, 1 = pan to oldest
  const vZoomRef = useRef(1); // vertical zoom: 1 = normal

  const [currentNote, setCurrentNote] = useState("-");
  const [currentFreq, setCurrentFreq] = useState(0);

  // Reset history on each new recording session
  useEffect(() => {
    historyRef.current = [];
    panRef.current = 0;
  }, [sessionId]);

  useEffect(() => {
    if (!analyser || !audioContext || !isActive) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const pitchHeight = height * 0.8;
    const intensityHeight = height * 0.2;

    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      analyser.getFloatTimeDomainData(buffer);

      // Detect pitch in Hz
    let rawFreq = detectPitch(buffer, audioContext.sampleRate);
let freq = detectHumanPitch(rawFreq);

let note =
  freq > 0
    ? frequencyToNote(freq)
    : { name: "-", octave: "-", midi: null };


      // Limit to C1..C6 (MIDI 24–72)
      if (note.midi === null || note.midi < 24 || note.midi > 84) {
        note = { name: "-", octave: "-", midi: null };
      }

      if (note.midi !== null) {
        setCurrentNote(`${note.name}${note.octave}`);
        setCurrentFreq(freq);
      } else {
        setCurrentNote("-");
        setCurrentFreq(0);
      }

      // Intensity (RMS)
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = buffer[i];
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / bufferLength); // 0..1 approx

      // Store history
      const entry = {
        midi: note.midi || 0,
        freq: freq || 0,
        rms: rms || 0,
      };
      const h = historyRef.current.slice();
      h.push(entry);
      if (h.length > HISTORY_LENGTH) {
        h.shift();
      }
      historyRef.current = h;

      // Draw background
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      // --- Draw pitch grid (C1..C6) ---
      const baseMinMidi = 24; // C1
      const baseMaxMidi = 72; // C6
      const centerMidi = (baseMinMidi + baseMaxMidi) / 2;
      const span = (baseMaxMidi - baseMinMidi) / vZoomRef.current;

      ctx.strokeStyle = "#1f2933";
      ctx.lineWidth = 1;
      ctx.font = "10px system-ui";
      ctx.fillStyle = "#6b7280";

      for (let octave = 1; octave <= 6; octave++) {
        const midiC = 12 * (octave + 1); // Cx
        const t = (midiC - (centerMidi - span / 2)) / span; // 0..1
        if (t >= 0 && t <= 1) {
          const y = pitchHeight - t * pitchHeight;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          ctx.fillText(`C${octave}`, 4, y - 2);
        }
      }

      // --- Draw pitch + intensity history ---
      const hist = historyRef.current;
      if (hist.length > 1) {
        const len = hist.length;

        const windowSize = Math.max(2, Math.floor(HISTORY_LENGTH / zoomH));
        const maxStart = Math.max(0, len - windowSize);
        const startIndex = Math.round(maxStart * (1 - panRef.current));
        const endIndex = Math.min(len, startIndex + windowSize);
        const visibleCount = endIndex - startIndex;

        // PITCH line
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#22c55e";
        ctx.beginPath();

        for (let i = startIndex; i < endIndex; i++) {
          const entry = hist[i];
          const relIndex = i - startIndex;
          const x = (relIndex / (visibleCount - 1)) * width;

          let yPitch;
         if (!entry.midi || entry.midi === 0) {
  // NO LINE when silent – break the stroke
  ctx.moveTo(x, yPitch); // move only, do NOT lineTo
  continue;
}


          if (relIndex === 0) {
            ctx.moveTo(x, yPitch);
          } else {
            ctx.lineTo(x, yPitch);
          }
        }
        ctx.stroke();

        // INTENSITY line (bottom strip)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();

        for (let i = startIndex; i < endIndex; i++) {
          const entry = hist[i];
          const relIndex = i - startIndex;
          const x = (relIndex / (visibleCount - 1)) * width;

          const val = Math.max(0, Math.min(1, entry.rms));
          const yInt = height - val * intensityHeight; // bottom strip

          if (relIndex === 0) {
            ctx.moveTo(x, yInt);
          } else {
            ctx.lineTo(x, yInt);
          }
        }
        ctx.stroke();
      }

      // Current note label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px system-ui";
      const label =
        currentNote !== "-" && currentFreq
          ? `${currentNote}  •  ${currentFreq.toFixed(1)} Hz`
          : "–";
      ctx.fillText(label, 10, 18);
    };

    draw();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [analyser, audioContext, isActive, zoomH, currentNote, currentFreq]);

  // Horizontal pan by dragging
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;
    let lastX = 0;

    const onPointerDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;

      const width = canvas.width;
      const delta = dx / width; // proportion of movement
      const next = Math.max(0, Math.min(1, panRef.current + delta * 0.7));
      panRef.current = next;
    };

    const onPointerUp = (e) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, []);

  // Vertical zoom via wheel / trackpad pinch on graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      if (!e.ctrlKey && e.deltaMode === 0) {
        // treat normal wheel as vertical zoom as well (for simplicity)
      }
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.05 : 0.95;
      const next = Math.max(0.5, Math.min(4, vZoomRef.current * factor));
      vZoomRef.current = next;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="rf-unified-graph-wrapper">
      <canvas
        ref={canvasRef}
        className="rf-canvas rf-canvas-unified"
        width={900}
        height={380}
      />
    </div>
  );
};

export default UnifiedGraph;

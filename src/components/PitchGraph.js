import React, { useRef, useEffect, useState } from "react";
import { detectPitch } from "../utils/pitchDetection";
import { frequencyToNote } from "../utils/noteMapping";

const HISTORY_LENGTH = 400; // how many history points we keep

const PitchGraph = ({ analyser, audioContext, isActive, zoom }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const historyRef = useRef([]);
  const [currentNoteText, setCurrentNoteText] = useState("-");

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

    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      analyser.getFloatTimeDomainData(buffer);
      const freq = detectPitch(buffer, audioContext.sampleRate);

      let noteInfo = frequencyToNote(freq);
      if (
        noteInfo.midi === null ||
        noteInfo.octave < 1 ||
        noteInfo.octave > 6
      ) {
        noteInfo = { name: "-", octave: "-", midi: null };
      }

      if (noteInfo.midi !== null) {
        setCurrentNoteText(
          `${noteInfo.name}${noteInfo.octave} (${freq.toFixed(1)} Hz)`
        );
      } else {
        setCurrentNoteText("-");
      }

      // store history (midi number or 0 for silence)
      const value = noteInfo.midi !== null ? noteInfo.midi : 0;
      const newHistory = historyRef.current.slice();
      newHistory.push(value);
      if (newHistory.length > HISTORY_LENGTH) {
        newHistory.shift();
      }
      historyRef.current = newHistory;

      // draw background
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      // grid for octaves C1–C6
      ctx.strokeStyle = "#1f2933";
      ctx.lineWidth = 1;
      for (let octave = 1; octave <= 6; octave++) {
        const midiForC = 12 * (octave + 1); // Cx midi
        // map midi 24 (C1) to bottom, 72 (C6) to top
        const y = height - ((midiForC - 24) / (72 - 24)) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = "#6b7280";
        ctx.font = "10px system-ui";
        ctx.fillText(`C${octave}`, 4, y - 2);
      }

      // draw pitch line with zoom
      const hist = historyRef.current;
      if (hist.length > 1) {
        const visibleCount = Math.max(2, Math.floor(hist.length / zoom));
        const startIndex = Math.max(0, hist.length - visibleCount);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#3b82f6";
        ctx.beginPath();

        for (let i = startIndex; i < hist.length; i++) {
          const midiVal = hist[i];
          const relIndex = i - startIndex;
          const x = (relIndex / (visibleCount - 1)) * width;

          let y;
          if (midiVal === 0) {
            // silence → line at bottom
            y = height;
          } else {
            const clamped = Math.min(72, Math.max(24, midiVal)); // C1..C6
            const t = (clamped - 24) / (72 - 24); // 0..1
            y = height - t * height;
          }

          if (relIndex === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [analyser, audioContext, isActive, zoom]);

  return (
    <div className="rf-graph">
      <h3 className="rf-graph-title">Pitch (C1–C6)</h3>
      <canvas
        ref={canvasRef}
        className="rf-canvas"
        width={300}
        height={140}
      />
      <div className="rf-note-label">Now: {currentNoteText}</div>
    </div>
  );
};

export default PitchGraph;

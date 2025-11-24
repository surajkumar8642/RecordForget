import React, { useRef, useEffect } from "react";

const HISTORY_LENGTH = 400;

const IntensityGraph = ({ analyser, isActive, zoom }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    if (!analyser || !isActive) {
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
    const data = new Uint8Array(bufferLength);

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(data);

      // RMS loudness 0..1
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (data[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      const newHistory = historyRef.current.slice();
      newHistory.push(rms);
      if (newHistory.length > HISTORY_LENGTH) {
        newHistory.shift();
      }
      historyRef.current = newHistory;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      const hist = historyRef.current;
      if (hist.length > 1) {
        const visibleCount = Math.max(2, Math.floor(hist.length / zoom));
        const startIndex = Math.max(0, hist.length - visibleCount);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();

        for (let i = startIndex; i < hist.length; i++) {
          const val = hist[i]; // 0..1
          const relIndex = i - startIndex;
          const x = (relIndex / (visibleCount - 1)) * width;
          const y = height - val * height;

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
  }, [analyser, isActive, zoom]);

  return (
    <div className="rf-graph">
      <h3 className="rf-graph-title">Intensity</h3>
      <canvas
        ref={canvasRef}
        className="rf-canvas"
        width={300}
        height={140}
      />
    </div>
  );
};

export default IntensityGraph;

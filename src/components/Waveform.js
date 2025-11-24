import React, { useRef, useEffect } from "react";

const Waveform = ({ analyser, isActive }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const dataRef = useRef(null);

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
    const bufferLength = analyser.fftSize;
    if (!dataRef.current || dataRef.current.length !== bufferLength) {
      dataRef.current = new Uint8Array(bufferLength);
    }
    const dataArray = dataRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#22c55e";
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    };

    draw();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [analyser, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`rf-canvas ${isActive ? "rf-canvas-active" : ""}`}
      width={600}
      height={160}
    />
  );
};

export default Waveform;

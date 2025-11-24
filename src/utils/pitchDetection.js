export function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;
  let bestOffset = -1;
  let bestCorrelation = 0;
  const rmsMin = 0.01;

  // RMS silence check
  let sumSquares = 0;
  for (let i = 0; i < SIZE; i++) {
    const v = buffer[i];
    sumSquares += v * v;
  }
  const rms = Math.sqrt(sumSquares / SIZE);
  if (rms < rmsMin) return 0;

  for (let offset = 8; offset < SIZE / 2; offset++) {
    let correlation = 0;
    for (let i = 0; i < SIZE / 2; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1) return 0;
  const freq = sampleRate / bestOffset;
  if (!isFinite(freq) || freq <= 0) return 0;
  return freq;
}

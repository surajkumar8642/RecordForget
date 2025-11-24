const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToNote(freq) {
  if (!freq || freq <= 0) {
    return { name: "-", octave: "-", midi: null };
  }

  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[noteIndex];

  return { name, octave, midi };
}

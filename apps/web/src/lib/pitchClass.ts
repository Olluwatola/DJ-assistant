export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function formatKey(key: number | null | undefined, mode: number | null | undefined): string {
  if (key === null || key === undefined || key < 0) return "—";
  const note = NOTE_NAMES[key] ?? "?";
  const modeName = mode === 0 ? "min" : "maj";
  return `${note} ${modeName}`;
}

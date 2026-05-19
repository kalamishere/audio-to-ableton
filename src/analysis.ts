// Lightweight analysis on top of the transcribed notes.
//
// These are honest estimates — Basic Pitch doesn't return tempo/key, so we
// derive them from the note events. Quality varies. Both functions clamp to
// reasonable ranges and return "" / 0 when confidence is low.

import type { TranscribedNote } from "./transcribe";

const PITCH_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/**
 * BPM estimation via inter-onset interval histogram.
 * Picks the modal IOI in [0.2, 1.0]s, converts to BPM, snaps to nearest int.
 * Returns 0 if we can't get a confident reading.
 */
export function estimateBpm(notes: TranscribedNote[]): number {
  if (notes.length < 4) return 0;
  const onsets = notes.map((n) => n.startTimeSeconds).sort((a, b) => a - b);
  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1];
    if (d >= 0.15 && d <= 1.5) iois.push(d);
  }
  if (iois.length < 4) return 0;

  // Bin to 10ms; pick the mode.
  const bins = new Map<number, number>();
  for (const d of iois) {
    const k = Math.round(d * 100); // 10ms buckets
    bins.set(k, (bins.get(k) || 0) + 1);
  }
  let bestK = 0, bestCount = 0;
  for (const [k, c] of bins) if (c > bestCount) { bestK = k; bestCount = c; }
  const ioi = bestK / 100;
  if (ioi <= 0) return 0;

  // Quarter-note assumption: BPM = 60 / IOI. Snap into 60–180 range.
  let bpm = Math.round(60 / ioi);
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm = Math.round(bpm / 2);
  return bpm;
}

/**
 * Key estimation — Krumhansl-Schmuckler-style template match.
 * Builds a 12-bin pitch-class histogram weighted by note duration, scores
 * against major/minor profiles, returns the best match (e.g. "C minor").
 */
export function detectKey(notes: TranscribedNote[]): string {
  if (notes.length < 4) return "";
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[((n.pitchMidi % 12) + 12) % 12] += n.durationSeconds;

  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return "";
  const norm = hist.map((v) => v / total);

  // Krumhansl profiles
  const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minor = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function corr(a: number[], b: number[]): number {
    const meanA = a.reduce((x, y) => x + y, 0) / a.length;
    const meanB = b.reduce((x, y) => x + y, 0) / b.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < 12; i++) {
      const ax = a[i] - meanA, bx = b[i] - meanB;
      num += ax * bx; da += ax * ax; db += bx * bx;
    }
    return num / Math.sqrt(da * db || 1);
  }

  let best = { key: "", score: -2 };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotMaj = major.map((_, i) => major[(i - tonic + 12) % 12]);
    const rotMin = minor.map((_, i) => minor[(i - tonic + 12) % 12]);
    const sMaj = corr(norm, rotMaj);
    const sMin = corr(norm, rotMin);
    if (sMaj > best.score) best = { key: `${PITCH_NAMES[tonic]} major`, score: sMaj };
    if (sMin > best.score) best = { key: `${PITCH_NAMES[tonic]} minor`, score: sMin };
  }
  return best.score > 0.3 ? best.key : "";
}

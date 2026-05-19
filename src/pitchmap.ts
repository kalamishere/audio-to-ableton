// Render a pitch-map SVG of transcribed notes — x = time, y = pitch, width = duration.
// Adapted from V1's `buildPitchMap` (standalone/public/index.html).

import type { TranscribedNote } from "./transcribe";

export function renderPitchMap(
  svg: SVGSVGElement,
  notes: TranscribedNote[],
  durationSec: number,
) {
  if (!notes.length) {
    svg.innerHTML = `<text x="50" y="50" text-anchor="middle" fill="#999" font-size="6">No notes detected</text>`;
    return;
  }

  const lo = Math.min(...notes.map((n) => n.pitchMidi));
  const hi = Math.max(...notes.map((n) => n.pitchMidi));
  const range = Math.max(1, hi - lo);
  const W = 100, H = 100;
  const padY = 8;
  const noteH = Math.max(1.2, (H - padY * 2) / Math.max(8, range));

  const rects = notes
    .map((n) => {
      const xPct = Math.min(99, (n.startTimeSeconds / Math.max(0.1, durationSec)) * 100);
      const wPct = Math.max(0.5, (n.durationSeconds / Math.max(0.1, durationSec)) * 100);
      const yPct = padY + ((hi - n.pitchMidi) / range) * (H - padY * 2);
      const opacity = 0.4 + Math.min(0.6, n.amplitude * 0.6);
      return `<rect x="${xPct}" y="${yPct}" width="${wPct}" height="${noteH}" fill="#ff5722" opacity="${opacity.toFixed(2)}" rx="0.3"/>`;
    })
    .join("");

  svg.innerHTML = rects;
}

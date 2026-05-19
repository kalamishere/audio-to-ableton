# audio-to-ableton

Funnel-first standalone web app for **Ableton V1**. Visitors drop audio or video, get a transcription with a MIDI download, and the primary CTA is V1.

## Status

**v0.1 scaffold** — not yet wired to deps. To run:

```bash
npm install
npm run dev
```

## Architecture

All client-side. No backend in v0.1 (email capture for non-Mac users is the eventual exception).

```
src/
  main.ts       — DOM wiring, stage transitions
  decode.ts     — file → mono AudioBuffer (handles audio + video)
  transcribe.ts — Spotify Basic Pitch wrapper
  midi.ts       — note events → .mid (Tone.js)
  als.ts        — note events → .als (PLACEHOLDER — see TODO.md)
  pitchmap.ts   — result-page SVG visualiser
  analysis.ts   — BPM + key estimation from notes
  styles.css    — V1's light & playful tokens
```

## Funnel philosophy

Read `COPY.md` first. The TL;DR: **the MIDI download is the consolation prize. The Ableton project is the wedge. The V1 download is the win.**

## See also

- `TODO.md` — what's stubbed
- `COPY.md` — landing & result page voice

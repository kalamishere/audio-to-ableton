#!/usr/bin/env node
// Smoke test: substitute placeholders, gzip, write to test.als.
// Open the result manually in Ableton Live 12 to confirm it loads.
//
//   node scripts/test-als.mjs
//   open /tmp/test.als

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const tpl = fs.readFileSync(path.join(root, "public/als-template.xml"), "utf8");
const clipTpl = fs.readFileSync(path.join(root, "public/als-clip-template.xml"), "utf8");

// Some made-up notes — descending C-major arpeggio.
const notes = [
  { pitchMidi: 72, startTimeSeconds: 0,    durationSeconds: 0.5, amplitude: 0.8 },
  { pitchMidi: 71, startTimeSeconds: 0.5,  durationSeconds: 0.5, amplitude: 0.7 },
  { pitchMidi: 69, startTimeSeconds: 1.0,  durationSeconds: 0.5, amplitude: 0.7 },
  { pitchMidi: 67, startTimeSeconds: 1.5,  durationSeconds: 0.5, amplitude: 0.7 },
  { pitchMidi: 65, startTimeSeconds: 2.0,  durationSeconds: 1.0, amplitude: 0.9 },
  { pitchMidi: 64, startTimeSeconds: 3.0,  durationSeconds: 1.0, amplitude: 0.9 },
];

const bpm = 120;
const beatsPerSecond = bpm / 60;
const clipName = "Audio → Ableton transcription";
const trackName = "Transcription";

// Group notes by pitch → KeyTrack
const byPitch = new Map();
let nextNoteId = 1;
for (const n of notes) {
  const arr = byPitch.get(n.pitchMidi) || [];
  arr.push({
    timeBeats: n.startTimeSeconds * beatsPerSecond,
    durationBeats: Math.max(0.05, n.durationSeconds * beatsPerSecond),
    velocity: Math.max(1, Math.min(127, Math.round(n.amplitude * 127))),
    noteId: nextNoteId++,
  });
  byPitch.set(n.pitchMidi, arr);
}
const lengthBeats = Math.max(
  4,
  Math.ceil(notes.reduce((m, n) => Math.max(m, (n.startTimeSeconds + n.durationSeconds) * beatsPerSecond), 0)),
);

const keyTracksXml = [...byPitch.entries()]
  .sort(([a], [b]) => a - b)
  .map(([pitch, evts], i) => {
    const noteEvents = evts
      .map(
        (e) =>
          `<MidiNoteEvent Time="${e.timeBeats.toFixed(4)}" Duration="${e.durationBeats.toFixed(4)}" Velocity="${e.velocity}" OffVelocity="0" NoteId="${e.noteId}" />`,
      )
      .join("");
    return `<KeyTrack Id="${i}"><Notes>${noteEvents}</Notes><MidiKey Value="${pitch}" /></KeyTrack>`;
  })
  .join("");

const clipXml = clipTpl
  .replaceAll("{{LENGTH_BEATS}}", String(lengthBeats))
  .replaceAll("{{CLIP_NAME}}", clipName)
  .replaceAll("{{KEY_TRACKS}}", keyTracksXml)
  .replaceAll("{{NEXT_NOTE_ID}}", String(nextNoteId));

const xml = tpl
  .replaceAll("{{TRACK_NAME}}", trackName)
  .replaceAll("{{CLIP_XML}}", clipXml);

const gz = zlib.gzipSync(Buffer.from(xml, "utf8"));
fs.writeFileSync("/tmp/test.als", gz);
console.log(`Wrote /tmp/test.als (${gz.length} bytes gzipped, ${xml.length} bytes raw)`);
console.log(`Notes: ${notes.length}, length: ${lengthBeats} beats, BPM: ${bpm}`);
console.log("Open with: open /tmp/test.als");

// Round-trip sanity check
const back = zlib.gunzipSync(gz).toString("utf8");
if (back !== xml) {
  console.error("Round-trip mismatch!");
  process.exit(1);
}
console.log("Gzip round-trip OK.");

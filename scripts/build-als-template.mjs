#!/usr/bin/env node
// Build the .als template from a captured Live 12 baseline.
//
// Run once (or whenever Ableton's schema bumps):
//   node scripts/build-als-template.mjs
//
// Inputs:
//   /tmp/baseline                 — gunzipped .als from Live 12 (any project,
//                                   we only need its first empty MidiTrack +
//                                   one populated MidiClip + post-Tracks tail)
// Outputs:
//   public/als-template.xml       — XML with {{PLACEHOLDERS}} for runtime
//                                   substitution by src/als.ts

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const baseline = fs.readFileSync("/tmp/baseline", "utf8");
const lines = baseline.split("\n");

// 1) Header (everything up to and including <Tracks>)
const tracksOpenIdx = lines.findIndex((l) => /<Tracks>/.test(l));
const head = lines.slice(0, tracksOpenIdx + 1);

// 2) First empty MidiTrack — used as the track shell.
const trackStarts = lines.flatMap((l, i) => (/<MidiTrack /.test(l) ? [i] : []));
const trackEnds = lines.flatMap((l, i) => (/<\/MidiTrack>/.test(l) ? [i] : []));
const trackOpen = trackStarts[0];
const trackClose = trackEnds[0];
let track = lines.slice(trackOpen, trackClose + 1);

// Empty ClipSlot 0 looks like:
//   <ClipSlot Id="0">
//     <LomId Value="0" />
//     <ClipSlot>
//       <Value />
//     </ClipSlot>
//     <HasStop Value="true" />
//     <NeedRefreeze Value="true" />
//   </ClipSlot>
//
// We replace `<Value />` in the FIRST ClipSlot with `<Value>{{CLIP_XML}}</Value>`.
const trackText = track.join("\n");
let firstSlotPatched = false;
const patchedTrack = trackText.replace(
  /(<ClipSlot Id="0">[\s\S]*?<ClipSlot>\s*)<Value\s*\/>(\s*<\/ClipSlot>)/,
  (_m, pre, post) => {
    firstSlotPatched = true;
    return `${pre}<Value>{{CLIP_XML}}</Value>${post}`;
  },
);
if (!firstSlotPatched) {
  console.error("Could not find empty ClipSlot 0 to patch.");
  process.exit(1);
}

// Patch the track Name to {{TRACK_NAME}}.
const namePatched = patchedTrack.replace(
  /<EffectiveName Value="[^"]*"\s*\/>[\s\S]*?<UserName Value="[^"]*"\s*\/>/,
  (m) =>
    m
      .replace(/EffectiveName Value="[^"]*"/, 'EffectiveName Value="{{TRACK_NAME}}"')
      .replace(/UserName Value="[^"]*"/, 'UserName Value="{{TRACK_NAME}}"'),
);
track = namePatched.split("\n");

// 3) Tail (everything from </Tracks> through </Ableton>)
const tracksCloseIdx = lines.findIndex((l) => /<\/Tracks>/.test(l));
const tail = lines.slice(tracksCloseIdx);

// 4) Assemble template (track replaces all original tracks)
const xml = [...head, ...track, ...tail].join("\n");

// 5) Build the MidiClip template — extract one populated <MidiClip> from the
//    baseline, parameterise notes/length/name.
const clipMatch = baseline.match(/<MidiClip Id="0" Time="0">[\s\S]*?<\/MidiClip>/);
if (!clipMatch) {
  console.error("Could not find a populated MidiClip in the baseline.");
  process.exit(1);
}
let clipTpl = clipMatch[0]
  // Length-related fields → {{LENGTH_BEATS}}
  .replace(/<CurrentEnd Value="\d+(?:\.\d+)?" \/>/, '<CurrentEnd Value="{{LENGTH_BEATS}}" />')
  .replace(/<LoopEnd Value="\d+(?:\.\d+)?" \/>/, '<LoopEnd Value="{{LENGTH_BEATS}}" />')
  .replace(/<OutMarker Value="\d+(?:\.\d+)?" \/>/, '<OutMarker Value="{{LENGTH_BEATS}}" />')
  .replace(/<OtherTime Value="\d+(?:\.\d+)?" \/>/, '<OtherTime Value="{{LENGTH_BEATS}}" />')
  .replace(/<HiddenLoopEnd Value="\d+(?:\.\d+)?" \/>/, '<HiddenLoopEnd Value="{{LENGTH_BEATS}}" />')
  // Clip name
  .replace(/<Name Value="[^"]*" \/>/, '<Name Value="{{CLIP_NAME}}" />')
  // Replace the entire <KeyTracks>...</KeyTracks> with a placeholder
  .replace(/<KeyTracks>[\s\S]*?<\/KeyTracks>/, "<KeyTracks>{{KEY_TRACKS}}</KeyTracks>")
  // NoteIdGenerator's NextId
  .replace(/<NoteIdGenerator>\s*<NextId Value="\d+" \/>\s*<\/NoteIdGenerator>/,
    '<NoteIdGenerator><NextId Value="{{NEXT_NOTE_ID}}" /></NoteIdGenerator>')
  // GrooveSettings can reference an undefined groove — neutralise.
  .replace(/<GrooveSettings>[\s\S]*?<\/GrooveSettings>/, "<GrooveSettings><GrooveId Value=\"-1\" /></GrooveSettings>")
  // Disabled=true means muted clip — flip to false so it plays.
  .replace(/<Disabled Value="true" \/>/, '<Disabled Value="false" />');

// 6) Write outputs
const tplPath = path.join(root, "public", "als-template.xml");
const clipPath = path.join(root, "public", "als-clip-template.xml");
fs.mkdirSync(path.dirname(tplPath), { recursive: true });
fs.writeFileSync(tplPath, xml, "utf8");
fs.writeFileSync(clipPath, clipTpl, "utf8");

console.log(`Wrote ${tplPath} (${xml.length.toLocaleString()} bytes)`);
console.log(`Wrote ${clipPath} (${clipTpl.length.toLocaleString()} bytes)`);

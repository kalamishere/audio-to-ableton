// Generate an Ableton Live Set (.als) — the wedge feature.
//
// .als files are gzipped XML conforming to Live's project schema. We ship two
// captured templates from a Live 12 baseline (see scripts/build-als-template.mjs):
//
//   public/als-template.xml      — full LiveSet wrapper with one MIDI track,
//                                  empty ClipSlot 0, {{CLIP_XML}} placeholder
//   public/als-clip-template.xml — one MidiClip with {{KEY_TRACKS}},
//                                  {{LENGTH_BEATS}}, {{CLIP_NAME}}, etc.
//
// At runtime we group transcribed notes by pitch into <KeyTrack> elements,
// substitute placeholders, gzip via the browser's CompressionStream API, and
// hand the user a `.als` they can double-click into Live 12.

import type { TranscribedNote } from "./transcribe";

let templateCache: { full: string; clip: string } | null = null;

async function loadTemplates(): Promise<{ full: string; clip: string }> {
  if (templateCache) return templateCache;
  const [full, clip] = await Promise.all([
    fetch("/als-template.xml").then((r) => {
      if (!r.ok) throw new Error("Could not load .als template");
      return r.text();
    }),
    fetch("/als-clip-template.xml").then((r) => {
      if (!r.ok) throw new Error("Could not load .als clip template");
      return r.text();
    }),
  ]);
  templateCache = { full, clip };
  return templateCache;
}

function escapeXmlAttr(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!),
  );
}

async function gzip(input: string): Promise<Uint8Array> {
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

interface BuildAlsArgs {
  notes: TranscribedNote[];
  bpm: number;
  fileName: string;
}

/**
 * Build the .als XML. Returns the raw XML string before gzip.
 * Exported for testability; production callers should use {@link buildAlsBlob}.
 */
export async function buildAlsXml({ notes, bpm, fileName }: BuildAlsArgs): Promise<string> {
  const { full, clip } = await loadTemplates();
  const tempo = bpm > 0 ? bpm : 120;
  const beatsPerSecond = tempo / 60;

  // Group by pitch → KeyTrack, assign monotonic NoteIds.
  const byPitch = new Map<number, Array<{
    timeBeats: number;
    durationBeats: number;
    velocity: number;
    noteId: number;
  }>>();
  let nextNoteId = 1;
  for (const n of notes) {
    const arr = byPitch.get(n.pitchMidi) ?? [];
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
    Math.ceil(
      notes.reduce(
        (m, n) => Math.max(m, (n.startTimeSeconds + n.durationSeconds) * beatsPerSecond),
        0,
      ),
    ),
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

  const clipName = escapeXmlAttr(fileName || "Audio → Ableton transcription");
  const trackName = escapeXmlAttr(fileName || "Transcription");

  const clipXml = clip
    .replaceAll("{{LENGTH_BEATS}}", String(lengthBeats))
    .replaceAll("{{CLIP_NAME}}", clipName)
    .replaceAll("{{KEY_TRACKS}}", keyTracksXml)
    .replaceAll("{{NEXT_NOTE_ID}}", String(nextNoteId));

  return full
    .replaceAll("{{TRACK_NAME}}", trackName)
    .replaceAll("{{CLIP_XML}}", clipXml);
}

/** Build the gzipped .als Blob ready for download. */
export async function buildAlsBlob(
  notes: TranscribedNote[],
  bpm: number,
  fileName: string,
): Promise<Blob> {
  const xml = await buildAlsXml({ notes, bpm, fileName });
  const bytes = await gzip(xml);
  return new Blob([bytes], { type: "application/octet-stream" });
}

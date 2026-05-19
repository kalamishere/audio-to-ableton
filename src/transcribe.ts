// Browser-side wrapper around @spotify/basic-pitch.
// Decodes the file with WebAudio, runs the model, returns notes + duration.

import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";
import { decodeToMonoBuffer } from "./decode";

export interface TranscribedNote {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
}

export interface TranscribeOptions {
  onsetThreshold?: number;
  frameThreshold?: number;
  /** Minimum note length, in frames (~22ms each at 22050 Hz). Default 5. */
  minNoteLengthFrames?: number;
  onProgress?: (label: string, pct: number) => void;
}

/**
 * Model is self-hosted at `/model/model.json` (+ shard binaries alongside).
 * Files are copied into `public/model/` by `scripts/sync-model.mjs`, which
 * runs automatically via `npm run dev` / `npm run build`. To refresh after
 * bumping `@spotify/basic-pitch` in package.json, just re-run install.
 *
 * Why self-host: reliability (no jsdelivr dep), and the "your audio never
 * leaves your machine" promise stays internally coherent — even the model
 * fetch comes from our origin.
 */
const MODEL_URL = "/model/model.json";

export async function transcribe(
  file: File,
  opts: TranscribeOptions = {},
): Promise<{ notes: TranscribedNote[]; durationSec: number }> {
  const onProgress = opts.onProgress ?? (() => {});
  const onsetThreshold = opts.onsetThreshold ?? 0.5;
  const frameThreshold = opts.frameThreshold ?? 0.3;
  const minNoteLengthFrames = opts.minNoteLengthFrames ?? 5;

  // Handles both audio (wav/mp3/m4a) and video (mp4/mov/webm) — falls back
  // to real-time playback extraction when decodeAudioData rejects the container.
  const audioBuffer = await decodeToMonoBuffer(file, onProgress);
  const durationSec = audioBuffer.duration;

  onProgress("Loading transcription model…", 42);
  const basicPitch = new BasicPitch(MODEL_URL);

  onProgress("Listening…", 50);
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await basicPitch.evaluateModel(
    audioBuffer.getChannelData(0),
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (pct) => onProgress("Listening…", 50 + pct * 0.4),
  );

  onProgress("Picking notes…", 92);
  const polyNotes = outputToNotesPoly(
    frames,
    onsets,
    onsetThreshold,
    frameThreshold,
    minNoteLengthFrames,
  );
  const noteEvents = noteFramesToTime(
    addPitchBendsToNoteEvents(contours, polyNotes),
  );

  const notes: TranscribedNote[] = noteEvents.map((n: any) => ({
    startTimeSeconds: n.startTimeSeconds,
    durationSeconds: n.durationSeconds,
    pitchMidi: n.pitchMidi,
    amplitude: n.amplitude,
    pitchBends: n.pitchBends,
  }));

  onProgress("Done", 100);
  return { notes, durationSec };
}

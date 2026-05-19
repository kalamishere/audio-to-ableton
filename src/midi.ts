// Build a Standard MIDI File from transcribed notes.

import { Midi } from "@tonejs/midi";
import type { TranscribedNote } from "./transcribe";

export function buildMidiBlob(notes: TranscribedNote[], bpm: number): Blob {
  const midi = new Midi();
  midi.header.setTempo(bpm > 0 ? bpm : 120);
  const track = midi.addTrack();
  track.name = "Transcription";

  for (const n of notes) {
    track.addNote({
      midi: n.pitchMidi,
      time: n.startTimeSeconds,
      duration: Math.max(0.05, n.durationSeconds),
      velocity: Math.max(0.1, Math.min(1, n.amplitude)),
    });
  }

  return new Blob([midi.toArray()], { type: "audio/midi" });
}

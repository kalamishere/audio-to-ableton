// Decode any audio-bearing file (wav/mp3/m4a/mp4/mov/webm…) into an AudioBuffer
// at 22.05 kHz mono — the input format Basic Pitch expects.
//
// Strategy:
//   1. Try `AudioContext.decodeAudioData` on the raw bytes at the platform's
//      default sample rate (Safari rejects some MP4s when ctx is forced to
//      22050). Then resample/down-mix into a 22050 Hz mono buffer.
//   2. If decodeAudioData throws, fall back to a real-time playback extractor:
//      load into a hidden <video>, route through MediaElementSource into a
//      ScriptProcessor with a muted output node, capture samples as it plays.
//      Slower (real-time at 1–4× rate) but works for any container the
//      browser can play.

const TARGET_SR = 22050;

export async function decodeToMonoBuffer(
  file: File,
  onProgress?: (label: string, pct: number) => void,
): Promise<AudioBuffer> {
  onProgress?.("Decoding audio…", 14);
  const buf = await file.arrayBuffer();

  // Fast path: native decode at platform-default rate, then resample.
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
    try { await ctx.close(); } catch {}
    onProgress?.("Resampling…", 24);
    return await resampleToMono(audioBuffer, TARGET_SR);
  } catch (err) {
    console.log("[a2a] decodeAudioData failed, falling back to playback extractor:", err);
  }

  onProgress?.("Extracting audio from video…", 14);
  return extractByPlayback(file, onProgress);
}

/** Down-mix to mono and resample to `targetSR` using OfflineAudioContext. */
async function resampleToMono(src: AudioBuffer, targetSR: number): Promise<AudioBuffer> {
  const length = Math.ceil((src.duration * targetSR));
  const off = new OfflineAudioContext(1, length, targetSR);
  const node = off.createBufferSource();
  node.buffer = src;
  // Down-mix: connect via a ChannelMerger? Simpler: rely on automatic
  // down-mixing because destination has 1 channel.
  node.connect(off.destination);
  node.start(0);
  const out = await off.startRendering();
  return out;
}

/**
 * Real-time playback extractor for files the browser can play but
 * decodeAudioData rejects (lots of MP4s from phones, MOV, MKV, some WebM).
 *
 * Routes the media through a ScriptProcessor with a 0-gain output so the user
 * doesn't hear the extraction. Plays at the highest playbackRate the browser
 * permits (Chrome up to 16×, Safari ~2×).
 */
async function extractByPlayback(
  file: File,
  onProgress?: (label: string, pct: number) => void,
): Promise<AudioBuffer> {
  const url = URL.createObjectURL(file);
  const media = document.createElement("video");
  media.src = url;
  media.muted = true;
  media.playsInline = true;
  media.preload = "auto";
  media.crossOrigin = "anonymous";
  // Some browsers won't fire `loadedmetadata` if not in the DOM.
  media.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none;";
  document.body.appendChild(media);

  // Wait for metadata, but don't hang forever.
  await new Promise<void>((res, rej) => {
    const cleanup = () => {
      media.removeEventListener("loadedmetadata", onMeta);
      media.removeEventListener("error", onErr);
      clearTimeout(timer);
    };
    const onMeta = () => { cleanup(); res(); };
    const onErr = () => { cleanup(); rej(new Error("Couldn't load this file. Try another format (MP4 / MOV / WAV / MP3).")); };
    const timer = setTimeout(() => {
      cleanup();
      rej(new Error("Loading timed out. Try a smaller file or a different format."));
    }, 15_000);
    media.addEventListener("loadedmetadata", onMeta);
    media.addEventListener("error", onErr);
  });

  const duration = isFinite(media.duration) && media.duration > 0 ? media.duration : 60;

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // Resume if suspended (autoplay policy may have suspended it on construction).
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch {}
  }

  const src = ctx.createMediaElementSource(media);
  const bufferSize = 4096;
  const proc = (ctx as any).createScriptProcessor(bufferSize, 1, 1);
  // Mute the output — ScriptProcessor still fires onaudioprocess as long as
  // *something* is connected to the destination, but the user hears silence.
  const muteGain = ctx.createGain();
  muteGain.gain.value = 0;

  const chunks: Float32Array[] = [];
  proc.onaudioprocess = (e: AudioProcessingEvent) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  src.connect(proc);
  proc.connect(muteGain);
  muteGain.connect(ctx.destination);

  // Try fast playback. Some browsers cap silently — that's fine, we'll just
  // wait the full duration.
  try { media.playbackRate = 4; } catch {}

  try { await media.play(); }
  catch (err) {
    cleanup();
    throw new Error("Couldn't play the file for audio extraction. " +
      "Some browsers block autoplay — click the page once and retry, " +
      "or upload an audio-only file (WAV / MP3 / M4A).");
  }

  await new Promise<void>((res) => {
    const tick = setInterval(() => {
      if (onProgress && duration > 0) {
        const pct = Math.min(40, 14 + (media.currentTime / duration) * 26);
        onProgress("Extracting audio from video…", pct);
      }
      if (media.ended || media.currentTime >= duration - 0.05) {
        clearInterval(tick);
        res();
      }
    }, 200);
  });

  const sampleRate = ctx.sampleRate;
  cleanup();

  // Stitch chunks at ctx.sampleRate, then resample to TARGET_SR.
  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total === 0) throw new Error("Couldn't capture any audio from this file. Try an audio-only upload.");

  const stitched = new AudioBuffer({
    length: total,
    numberOfChannels: 1,
    sampleRate,
  });
  const dst = stitched.getChannelData(0);
  let offset = 0;
  for (const c of chunks) { dst.set(c, offset); offset += c.length; }

  return await resampleToMono(stitched, TARGET_SR);

  function cleanup() {
    try { src.disconnect(); } catch {}
    try { proc.disconnect(); } catch {}
    try { muteGain.disconnect(); } catch {}
    try { media.pause(); } catch {}
    try { media.remove(); } catch {}
    try { URL.revokeObjectURL(url); } catch {}
    try { ctx.close(); } catch {}
  }
}

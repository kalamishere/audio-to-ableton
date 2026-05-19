// Audio → Ableton — funnel-first standalone web app.
// Drops audio, transcribes via Spotify Basic Pitch, generates MIDI + .als,
// pushes Ableton V1 download as the primary CTA.
//
// All client-side. The audio never leaves the browser.

import { transcribe, type TranscribedNote } from "./transcribe";
import { buildMidiBlob } from "./midi";
import { buildAlsBlob } from "./als";
import { renderPitchMap } from "./pitchmap";
import { detectKey, estimateBpm } from "./analysis";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let lastResult: {
  notes: TranscribedNote[];
  bpm: number;
  key: string;
  durationSec: number;
  fileName: string;
} | null = null;

function showStage(name: "Landing" | "Working" | "Result") {
  for (const s of ["Landing", "Working", "Result"]) {
    $("stage" + s).classList.toggle("on", s === name);
  }
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

async function handleFile(file: File) {
  console.log("[a2a] handleFile:", file.name, file.type, `${(file.size / 1024 / 1024).toFixed(1)}MB`);
  showStage("Working");
  $("workingTitle").textContent = "Transcribing…";
  $("workingSub").textContent = "Loading the Basic Pitch model. First run takes ~5 seconds.";
  // Start with the indeterminate slide animation — we don't have a real %
  // until Basic Pitch ticks back. Re-add the class since a previous run
  // may have removed it via setProgress().
  const wrap = ($("progressBar") as HTMLElement).parentElement;
  if (wrap) wrap.classList.add("indeterminate");
  ($("progressBar") as HTMLElement).style.width = "";

  try {
    const result = await transcribe(file, {
      onProgress: (label, pct) => {
        $("workingTitle").textContent = label;
        setProgress(pct);
      },
    });
    const bpm = estimateBpm(result.notes);
    const key = detectKey(result.notes);

    lastResult = {
      notes: result.notes,
      bpm,
      key,
      durationSec: result.durationSec,
      fileName: file.name.replace(/\.[^.]+$/, ""),
    };

    renderResult();
  } catch (err) {
    console.error("[a2a] handleFile failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    $("workingTitle").textContent = "Couldn't transcribe that file";
    $("workingSub").innerHTML =
      `${msg}<br><br>Try a different format — WAV / MP3 / M4A / MP4 / MOV usually work best. ` +
      `<button class="link" id="retryBtn">Try again</button>`;
    setProgress(0);
    document.getElementById("retryBtn")?.addEventListener("click", () => {
      (document.getElementById("file") as HTMLInputElement).value = "";
      showStage("Landing");
    });
  }
}

function setProgress(pct: number) {
  // Once real progress arrives, drop the indeterminate-slide animation and
  // switch to a measured fill. Matches V1's splash bar behavior.
  const wrap = ($("progressBar") as HTMLElement).parentElement;
  if (wrap) wrap.classList.remove("indeterminate");
  ($("progressBar") as HTMLElement).style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function renderResult() {
  if (!lastResult) return;
  const { notes, bpm, key, durationSec } = lastResult;

  $("statNotes").textContent = String(notes.length);
  $("statBpm").textContent = bpm > 0 ? String(bpm) : "—";
  $("statKey").textContent = key || "—";
  $("statDur").textContent = fmtDuration(durationSec);

  renderPitchMap($("pitchMap") as unknown as SVGSVGElement, notes, durationSec);

  // Mac-detect for the V1 CTA
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
  const cta = $("downloadV1") as HTMLAnchorElement;
  const meta = $("ctaMeta");
  if (isMac) {
    cta.textContent = "Download Ableton V1 — free";
    cta.href = "https://pollinations.ai/ableton-v1/download"; // TODO: real URL
    meta.textContent = "macOS · Apple Silicon & Intel · ~170 MB";
  } else {
    cta.textContent = "Get notified when Windows ships";
    cta.href = "https://pollinations.ai/ableton-v1/notify"; // TODO: real URL
    meta.textContent = "Currently macOS only — leave your email and we'll ping you.";
  }

  showStage("Result");
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Wire up DOM ──
function wire() {
  // Prevent the browser from navigating to a dropped file when the user misses
  // the drop zone — a very easy way to silently lose an upload.
  ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      if ((e.target as HTMLElement)?.closest?.("#drop")) return;
      e.preventDefault();
      if (evt === "drop") {
        const f = (e as DragEvent).dataTransfer?.files?.[0];
        if (f) handleFile(f);
      }
    });
  });

  const drop = $("drop");
  const file = $("file") as HTMLInputElement;
  const pick = $("pickBtn");

  drop.addEventListener("click", () => file.click());
  pick.addEventListener("click", (e) => {
    e.stopPropagation();
    file.click();
  });
  file.addEventListener("change", () => {
    if (file.files && file.files[0]) handleFile(file.files[0]);
  });

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    const f = e.dataTransfer?.files[0];
    if (f) handleFile(f);
  });

  $("downloadMidi").addEventListener("click", () => {
    if (!lastResult) return;
    const blob = buildMidiBlob(lastResult.notes, lastResult.bpm);
    downloadBlob(blob, `${lastResult.fileName}.mid`);
  });

  $("downloadAls").addEventListener("click", async (e) => {
    if (!lastResult) return;
    const btn = e.currentTarget as HTMLButtonElement;
    const orig = btn.textContent;
    btn.textContent = "Building project…";
    btn.disabled = true;
    try {
      const blob = await buildAlsBlob(lastResult.notes, lastResult.bpm, lastResult.fileName);
      downloadBlob(blob, `${lastResult.fileName}.als`);
    } catch (err) {
      console.error("[a2a] .als build failed:", err);
      alert("Couldn't build the Ableton project: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      btn.textContent = orig;
      btn.disabled = false;
    }
  });

  $("tryAnother").addEventListener("click", () => {
    lastResult = null;
    file.value = "";
    showStage("Landing");
  });
}

wire();

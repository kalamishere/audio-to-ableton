# Audio → Ableton — landing & result-page copy

Working draft. Voice: confident, plain, no marketing throat-clearing. The funnel goal is **Ableton V1 download**; the free MIDI is the polite escape hatch.

---

## Hero (above the fold)

**H1:**
> Drop a track or a video. Get an Ableton project.

**Sub:**
> Audio file, voice memo, video clip — anything with sound. We'll transcribe it to MIDI and hand you a `.als` file ready to open in Live.

**Drop zone:**
> Drop audio or video here
> or *pick a file* · WAV, MP3, M4A, MP4, MOV · up to 60s for best results

**Trust strip (under the drop):**
- ● Runs in your browser — your audio never leaves your machine
- ● Free, no signup
- ● Powered by Spotify's Basic Pitch model

---

## "What you get" — three-card section

This is the wedge. The middle card is the differentiator vs. Spotify's tool.

### 1. A MIDI file
The notes we detected. Drag into any DAW.

### 2. An Ableton project *(highlighted)*
A `.als` with the notes pre-loaded into a MIDI track. Double-click to open.

### 3. A way to keep going
Open it in **Ableton V1** and say *"make this a synth bass"* — in any language.

---

## Result page

### Stats strip
- *N* notes
- *N* BPM (est.)
- *Key* (est.)
- *Duration*

### Pitch-map preview
A single SVG strip — same visual idiom as V1's transcription card. Lets people see "yes, that's my track."

### Primary CTA (orange, big)

**Eyebrow:** What you actually want →

**Headline:**
> Open this in Ableton with one click

**Body:**
> Ableton V1 turns your transcription into a live project, picks instruments, and lets you direct it in plain language — *"make it darker"*, *"agrega un bajo"*, in any language. Free during beta.

**Button (Mac):**
> Download Ableton V1 — free
> *macOS · Apple Silicon & Intel · ~170 MB*

**Button (non-Mac):**
> Get notified when Windows ships
> *Currently macOS only — leave your email and we'll ping you.*

### Secondary CTAs (smaller, ghost buttons)

**Heading:** Or just take the files

- Download MIDI
- Download Ableton project (`.als`)
- Try another track

---

## Footer

> Made with [pollinations.ai](https://pollinations.ai). Runs entirely in your browser. We never see your audio.

---

## Voice rules (for any future copy added here)

- **No "AI-powered."** Say what we're doing, not what we are.
- **No "revolutionize."** Don't tell people what to feel.
- **Lead with the verb the user is doing.** Drop, get, open, keep going.
- **The MIDI download is consolation, not headline.** Headlines belong to the Ableton story.
- **No pricing language on this page.** "Free" once, in the CTA. Done.
- **One italic per section, max.** They lose meaning when overused.

---

## SEO meta

- **Title:** Audio → Ableton — drop a track, get a project
- **Description:** Drop any audio file. We'll transcribe it to MIDI and hand you an Ableton-ready project. Free.
- **Open Graph:** card with the pitch-map strip + tagline.

## Open questions for review

1. **Headline framing.** Tested two: *"Drop a track. Get an Ableton project."* vs. *"Free MIDI from any audio — open it in Ableton."* The first leans into the wedge, the second leans into SEO/intent. We could A/B these.
2. **The Spotify name-drop in trust strip.** Helps credibility but slightly waters down our brand. Worth it for v0.1; revisit at scale.
3. **Suno-specific landing variant.** Held back from v0.1 — better to add as a separate `/suno` page once we have stem-sep so we don't promise more than the lossy melody we deliver.
4. **Email capture for non-Mac users.** Worth doing in v0.1? It costs us a backend (a tiny `/notify` endpoint). Probably yes — that's the only way Windows demand becomes legible.

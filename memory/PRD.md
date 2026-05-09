# PRD — unmark.audio

## Original Problem Statement
> "à l'aide de ce fichier tu peux créer un site compatible github pages pour supprimer les watermarks présents dans les musiques générées par IA"

User uploaded `ai-audio-fingerprint-remover-main.zip` (Python tool by geeknik using numpy/scipy/librosa). Asked for GitHub Pages compatible site. After clarification, chose **Option B**: 100% client-side JavaScript implementation using Web Audio API (Pyodide rejected due to mobile/low-power device incompatibility).

## Architecture
- **Pure static SPA** — React 19 + Tailwind + shadcn/ui, NO backend, NO database, NO third-party APIs
- Output: `frontend/build/` deployable to any static host (GitHub Pages, Cloudflare Pages, Netlify, Vercel)
- All audio processing in-browser via Web Audio API (`OfflineAudioContext`)

### Key files
- `frontend/src/App.js` — main UI orchestration
- `frontend/src/lib/audioProcessor.js` — decode + filter chain (low-pass, notch ×4, high-shelf, dither)
- `frontend/src/lib/wavEncoder.js` — 16-bit PCM WAV encoder (strips ALL metadata via re-encode)
- `frontend/src/components/{Dropzone,SettingsPanel,Waveform}.jsx`
- `frontend/package.json` — `homepage: "."` for GitHub Pages compatibility

## User Personas
- **Music creators** using AI generators (Suno, ElevenLabs, OpenAI) who want clean audio for distribution
- **Privacy-conscious users** who don't want to upload audio to a third-party server

## Core Requirements (static)
- 100% local processing, zero file upload to any server
- Works on mobile (low-power devices included)
- Compatible MP3, WAV, FLAC, OGG, M4A, AAC
- Deployable to GitHub Pages without server config
- French UI

## What's Implemented (2025-12)
- [x] Drag & drop + file picker upload
- [x] Web Audio decoding for all major formats
- [x] **4 presets**: Light / Standard / Aggressive / **Stealth** (all phases on)
- [x] Manual fine-tuning per module
- [x] **Phase A** (anti-detection):
  - [x] Pitch + time micro-shift via `playbackRate` (±0.4-1.5 %)
  - [x] Non-integer resample chain (origRate → 47983 Hz → origRate)
  - [x] Tape saturation via `WaveShaperNode` + tanh curve
  - [x] Pink noise floor injection (-50 to -80 dB) via Voss-McCartney
- [x] **Phase B** (FFT-based):
  - [x] Phase randomization above HF threshold (3-10 kHz config) via STFT 2048/Hann/hop ¼ + fft.js
  - [x] Spectral magnitude jitter (±0.1-1 dB per FFT bin)
  - [x] Micro time-warping via `setValueCurveAtTime` on `playbackRate`
- [x] **Phase C** (room/space cues):
  - [x] Short-IR convolution (random 25-50ms decay) via `ConvolverNode`
  - [x] Stereo M/S decorrelation (R-channel ~80µs delay) via `DelayNode`
- [x] **Random Seed mode**: randomises params per render → unique fingerprint each run
- [x] **MP3 export 320 kbps** via `@breezystack/lamejs` (in addition to WAV)
- [x] Before/after waveform visualization
- [x] Original + processed audio players
- [x] Reset flow
- [x] Cyberpunk dark glassmorphism design (Space Grotesk + JetBrains Mono)
- [x] Mobile responsive
- [x] Detailed step-by-step GitHub Pages deploy guide in `/app/README.md`

## Backlog (P2 / future)
- [ ] **P2** Batch processing (multiple files queue)
- [ ] **P2** Spectrogram view (FFT) before/after for visual feedback
- [ ] **P2** Codec round-trip MP3 320kbps then re-decode (extra natural codec signature)
- [ ] **P2** A/B blind test mode
- [ ] **P2** Pyodide fallback mode for power users (run original Python pipeline)
- [ ] **P2** Server-mode option for power users (FastAPI backend running real librosa pipeline)

## Next Tasks
- Generate `gh-pages` deploy GitHub Action template if user requests
- Optional: add lamejs for MP3 export

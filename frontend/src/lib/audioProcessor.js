// Client-side AI watermark / fingerprint remover — full pipeline.
//
// Phase A: low-pass / notch / high-shelf / pitch+time micro-shift /
//          resample chain / tape saturation / pink noise floor / dither
// Phase B: FFT phase randomization (HF), spectral magnitude jitter,
//          micro time-warping (variable playbackRate curve)
// Phase C: short-IR convolution (room cue), stereo M/S decorrelation
// Bonus  : Random Seed mode — randomises params on every render so the
//          same source produces a different fingerprint each time.

import { applyFFTProcessing, buildShortRoomIR } from "./fftProcessing";
import { audioBufferToMp3Blob } from "./mp3Encoder";

const PRESETS = {
  light: {
    lowpass: { enabled: true, cutoff: 19000, q: 0.7 },
    notches: { enabled: false, freqs: [16000, 17000, 18000, 19000], q: 12 },
    highShelf: { enabled: true, freq: 16000, gain: -3 },
    dither: { enabled: true, amount: 0.0008 },
    pitchTime: { enabled: false, ratePct: 0.4 },
    resampleChain: { enabled: false, intermediateRate: 47983 },
    tapeSaturation: { enabled: false, drive: 1.03 },
    pinkNoiseFloor: { enabled: false, levelDb: -70 },
    phaseRand: { enabled: false, hfStartHz: 6000, amount: 1.0 },
    magJitter: { enabled: false, dbRange: 0.3 },
    timeWarp: { enabled: false, depthPct: 0.2 },
    convolution: { enabled: false, durationMs: 25, decay: 6, mix: 0.08 },
    stereoDecorr: { enabled: false, delayUs: 60 },
  },
  standard: {
    lowpass: { enabled: true, cutoff: 17500, q: 0.7 },
    notches: { enabled: true, freqs: [16000, 17000, 18000, 19000], q: 14 },
    highShelf: { enabled: true, freq: 15000, gain: -6 },
    dither: { enabled: true, amount: 0.0015 },
    pitchTime: { enabled: true, ratePct: 0.6 },
    resampleChain: { enabled: true, intermediateRate: 47983 },
    tapeSaturation: { enabled: true, drive: 1.05 },
    pinkNoiseFloor: { enabled: true, levelDb: -65 },
    phaseRand: { enabled: false, hfStartHz: 6000, amount: 1.0 },
    magJitter: { enabled: false, dbRange: 0.3 },
    timeWarp: { enabled: false, depthPct: 0.2 },
    convolution: { enabled: false, durationMs: 30, decay: 6, mix: 0.1 },
    stereoDecorr: { enabled: false, delayUs: 60 },
    codecRoundTrip: { enabled: false, kbps: 320 },
  },
  aggressive: {
    lowpass: { enabled: true, cutoff: 16000, q: 0.7 },
    notches: { enabled: true, freqs: [14500, 16000, 17000, 18000, 19000, 20000], q: 18 },
    highShelf: { enabled: true, freq: 13500, gain: -9 },
    dither: { enabled: true, amount: 0.003 },
    pitchTime: { enabled: true, ratePct: 1.0 },
    resampleChain: { enabled: true, intermediateRate: 47983 },
    tapeSaturation: { enabled: true, drive: 1.08 },
    pinkNoiseFloor: { enabled: true, levelDb: -60 },
    phaseRand: { enabled: true, hfStartHz: 7000, amount: 0.6 },
    magJitter: { enabled: true, dbRange: 0.3 },
    timeWarp: { enabled: true, depthPct: 0.25 },
    convolution: { enabled: true, durationMs: 35, decay: 5.5, mix: 0.12 },
    stereoDecorr: { enabled: true, delayUs: 80 },
    codecRoundTrip: { enabled: true, kbps: 320 },
  },
  stealth: {
    // Maximum stealth — every counter-detection trick on.
    lowpass: { enabled: true, cutoff: 16500, q: 0.7 },
    notches: { enabled: true, freqs: [14500, 15500, 16000, 17000, 18000, 19000, 20000], q: 16 },
    highShelf: { enabled: true, freq: 14000, gain: -7 },
    dither: { enabled: true, amount: 0.002 },
    pitchTime: { enabled: true, ratePct: 1.2 },
    resampleChain: { enabled: true, intermediateRate: 47983 },
    tapeSaturation: { enabled: true, drive: 1.07 },
    pinkNoiseFloor: { enabled: true, levelDb: -62 },
    phaseRand: { enabled: true, hfStartHz: 6000, amount: 1.0 },
    magJitter: { enabled: true, dbRange: 0.4 },
    timeWarp: { enabled: true, depthPct: 0.3 },
    convolution: { enabled: true, durationMs: 40, decay: 5, mix: 0.14 },
    stereoDecorr: { enabled: true, delayUs: 90 },
    codecRoundTrip: { enabled: true, kbps: 320 },
  },
};

export const PRESET_NAMES = ["light", "standard", "aggressive", "stealth"];
export function getPreset(name) {
  return JSON.parse(JSON.stringify(PRESETS[name] || PRESETS.standard));
}

// Returns a settings clone with selected params randomised within sensible ranges.
// Used when Random Seed mode is enabled — every render produces a unique fingerprint.
export function randomiseSettings(settings) {
  const s = JSON.parse(JSON.stringify(settings));
  const rand = (min, max) => min + Math.random() * (max - min);
  if (s.pitchTime?.enabled) s.pitchTime.ratePct = rand(0.4, Math.max(0.5, s.pitchTime.ratePct * 1.5));
  if (s.resampleChain?.enabled) s.resampleChain.intermediateRate = Math.floor(rand(47000, 49500));
  if (s.tapeSaturation?.enabled) s.tapeSaturation.drive = rand(1.03, Math.max(1.04, s.tapeSaturation.drive));
  if (s.pinkNoiseFloor?.enabled) s.pinkNoiseFloor.levelDb = Math.round(rand(-72, -58));
  if (s.phaseRand?.enabled) s.phaseRand.hfStartHz = Math.floor(rand(5000, 8000));
  if (s.magJitter?.enabled) s.magJitter.dbRange = rand(0.2, 0.5);
  if (s.timeWarp?.enabled) s.timeWarp.depthPct = rand(0.15, 0.4);
  if (s.convolution?.enabled) {
    s.convolution.durationMs = Math.floor(rand(25, 50));
    s.convolution.decay = rand(4, 7);
    s.convolution.mix = rand(0.06, 0.16);
  }
  if (s.stereoDecorr?.enabled) s.stereoDecorr.delayUs = Math.floor(rand(50, 120));
  if (s.codecRoundTrip?.enabled) {
    // Vary bitrate slightly so the codec signature varies per run
    const bitrates = [256, 320];
    s.codecRoundTrip.kbps = bitrates[Math.floor(Math.random() * bitrates.length)];
  }
  return s;
}

// Decode any browser-supported audio file (mp3/wav/flac/m4a/ogg) -> AudioBuffer.
export async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    if (ctx.close) ctx.close();
  }
}

// ----- helpers -----

function makeTapeCurve(drive = 1.05, samples = 4096) {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

function makePinkNoiseBuffer(ctx, length, channels, levelDb) {
  const buf = ctx.createBuffer(channels, length, ctx.sampleRate);
  const amp = Math.pow(10, levelDb / 20);
  const numRows = 8;
  for (let c = 0; c < channels; c++) {
    const data = buf.getChannelData(c);
    const rows = new Array(numRows).fill(0);
    let runningSum = 0;
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * numRows);
      runningSum -= rows[idx];
      const v = Math.random() * 2 - 1;
      rows[idx] = v;
      runningSum += v;
      data[i] = (runningSum / numRows) * amp;
    }
  }
  return buf;
}

function makeDitherBuffer(ctx, length, channels, amount) {
  const buf = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() + Math.random() - 1) * amount;
    }
  }
  return buf;
}

// ----- main render passes -----

async function renderPass({
  buffer,
  outputSampleRate,
  outputLength,
  playbackRate,
  timeWarp,
  settings,
  applyFilters,
  applyNoiseLayers,
}) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offline = new Offline(buffer.numberOfChannels, outputLength, outputSampleRate);

  const source = offline.createBufferSource();
  source.buffer = buffer;

  // Variable rate (timeWarp) takes precedence over static playbackRate
  if (timeWarp?.enabled) {
    const baseRate = playbackRate || 1;
    const depth = (timeWarp.depthPct ?? 0.25) / 100;
    const N = 64;
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) raw[i] = (Math.random() - 0.5) * 2 * depth;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = raw[Math.max(0, i - 1)];
      const b = raw[i];
      const c = raw[Math.min(N - 1, i + 1)];
      curve[i] = baseRate * (1 + (a + b + c) / 3);
    }
    try {
      source.playbackRate.setValueCurveAtTime(curve, 0, buffer.duration);
    } catch (_e) {
      source.playbackRate.value = baseRate;
    }
  } else if (playbackRate && playbackRate !== 1) {
    source.playbackRate.value = playbackRate;
  }

  let node = source;

  if (applyFilters) {
    if (settings.lowpass?.enabled) {
      const lp = offline.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = settings.lowpass.cutoff;
      lp.Q.value = settings.lowpass.q ?? 0.7;
      node.connect(lp);
      node = lp;
    }
    if (settings.notches?.enabled && Array.isArray(settings.notches.freqs)) {
      const nyquist = outputSampleRate / 2;
      for (const f of settings.notches.freqs) {
        if (f >= nyquist) continue;
        const notch = offline.createBiquadFilter();
        notch.type = "notch";
        notch.frequency.value = f;
        notch.Q.value = settings.notches.q ?? 14;
        node.connect(notch);
        node = notch;
      }
    }
    if (settings.highShelf?.enabled) {
      const hs = offline.createBiquadFilter();
      hs.type = "highshelf";
      hs.frequency.value = settings.highShelf.freq;
      hs.gain.value = settings.highShelf.gain;
      node.connect(hs);
      node = hs;
    }
    if (settings.tapeSaturation?.enabled) {
      const ws = offline.createWaveShaper();
      ws.curve = makeTapeCurve(settings.tapeSaturation.drive ?? 1.05);
      ws.oversample = "4x";
      node.connect(ws);
      node = ws;
    }

    // Phase C: short-IR convolution with dry/wet mix
    if (settings.convolution?.enabled) {
      const conv = offline.createConvolver();
      conv.normalize = false;
      conv.buffer = buildShortRoomIR(offline, settings.convolution.durationMs ?? 35, settings.convolution.decay ?? 5.5);
      const dry = offline.createGain();
      const wet = offline.createGain();
      const merger = offline.createGain();
      const mix = settings.convolution.mix ?? 0.1;
      dry.gain.value = 1.0;
      wet.gain.value = mix;
      node.connect(dry);
      node.connect(conv);
      conv.connect(wet);
      dry.connect(merger);
      wet.connect(merger);
      node = merger;
    }

    // Phase C: stereo M/S decorrelation via tiny right-channel delay (HF cue)
    if (settings.stereoDecorr?.enabled && buffer.numberOfChannels >= 2) {
      const splitter = offline.createChannelSplitter(2);
      const merger = offline.createChannelMerger(2);
      const delay = offline.createDelay(0.005);
      delay.delayTime.value = (settings.stereoDecorr.delayUs ?? 80) / 1e6;
      node.connect(splitter);
      splitter.connect(merger, 0, 0); // L direct
      splitter.connect(delay, 1);
      delay.connect(merger, 0, 1); // R delayed
      node = merger;
    }
  }

  node.connect(offline.destination);

  if (applyNoiseLayers) {
    if (settings.dither?.enabled && settings.dither.amount > 0) {
      const ditherBuf = makeDitherBuffer(offline, outputLength, buffer.numberOfChannels, settings.dither.amount);
      const ds = offline.createBufferSource();
      ds.buffer = ditherBuf;
      ds.connect(offline.destination);
      ds.start(0);
    }
    if (settings.pinkNoiseFloor?.enabled) {
      const pinkBuf = makePinkNoiseBuffer(offline, outputLength, buffer.numberOfChannels, settings.pinkNoiseFloor.levelDb ?? -65);
      const ps = offline.createBufferSource();
      ps.buffer = pinkBuf;
      ps.connect(offline.destination);
      ps.start(0);
    }
  }

  source.start(0);
  return await offline.startRendering();
}

// Main entry — orchestrates Phase B FFT + Phase A passes + Phase C nodes.
export async function processBuffer(audioBuffer, settings, onProgress) {
  const origRate = audioBuffer.sampleRate;

  // PHASE B (pre-pass) — FFT spectral processing on raw input
  let working = audioBuffer;
  const fftEnabled = settings.phaseRand?.enabled || settings.magJitter?.enabled;
  if (fftEnabled) {
    if (onProgress) onProgress(0.05);
    working = await applyFFTProcessing(audioBuffer, settings, (p) => {
      if (onProgress) onProgress(0.05 + p * 0.45);
    });
  }

  // Pitch+time micro-shift (random sign)
  let playbackRate = 1;
  if (settings.pitchTime?.enabled) {
    const pct = (settings.pitchTime.ratePct ?? 0.6) / 100;
    const sign = Math.random() < 0.5 ? -1 : 1;
    playbackRate = 1 + sign * pct * (0.7 + Math.random() * 0.3);
  }

  const useResampleChain = !!settings.resampleChain?.enabled;
  const passRate = useResampleChain ? settings.resampleChain.intermediateRate || 47983 : origRate;
  const passLength = Math.max(1, Math.ceil((working.length * (passRate / origRate)) / playbackRate));

  // Fake progress UI for the Web Audio render passes
  const progStart = fftEnabled ? 0.5 : 0.05;
  const progEnd = 0.95;
  let cancelled = false;
  if (onProgress) {
    const start = performance.now();
    const totalSec = working.duration / playbackRate;
    const tick = () => {
      if (cancelled) return;
      const elapsed = (performance.now() - start) / 1000;
      const denom = Math.max(totalSec / (useResampleChain ? 4 : 8), 0.5);
      const r = Math.min(1, elapsed / denom);
      onProgress(progStart + r * (progEnd - progStart));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // PASS 1
  let mid = await renderPass({
    buffer: working,
    outputSampleRate: passRate,
    outputLength: passLength,
    playbackRate,
    timeWarp: settings.timeWarp,
    settings,
    applyFilters: true,
    applyNoiseLayers: true,
  });

  // PASS 2 — resample back to original rate if chain enabled
  let final = mid;
  if (useResampleChain) {
    const finalLength = Math.max(1, Math.ceil(mid.length * (origRate / passRate)));
    final = await renderPass({
      buffer: mid,
      outputSampleRate: origRate,
      outputLength: finalLength,
      playbackRate: 1,
      timeWarp: null,
      settings,
      applyFilters: false,
      applyNoiseLayers: false,
    });
  }

  cancelled = true;
  if (onProgress) onProgress(0.97);

  // Optional codec round-trip — encode to MP3 then decode back to AudioBuffer.
  // This stamps the output with a natural lossy-codec signature that AI detectors
  // expect on real recordings.
  if (settings.codecRoundTrip?.enabled) {
    try {
      const mp3Blob = audioBufferToMp3Blob(final, settings.codecRoundTrip.kbps ?? 320);
      const ab = await mp3Blob.arrayBuffer();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const decCtx = new Ctx();
      try {
        final = await decCtx.decodeAudioData(ab);
      } finally {
        if (decCtx.close) decCtx.close();
      }
    } catch (e) {
      // If round-trip fails (decoder issue), fall back silently to the WAV result.
      console.warn("Codec round-trip skipped:", e);
    }
  }

  if (onProgress) onProgress(1);
  return final;
}

// Build a downsampled waveform (peak data) for visualization.
export function buildPeakData(audioBuffer, targetBins = 600) {
  const channel = audioBuffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / targetBins));
  const peaks = new Float32Array(targetBins);
  for (let i = 0; i < targetBins; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}


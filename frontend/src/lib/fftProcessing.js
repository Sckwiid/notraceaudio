// Phase B + C audio enhancements for No Trace Audio
// FFT-based STFT phase randomization + spectral magnitude jitter
// (overlap-add Hann window, hop = N/4 for COLA reconstruction)

import FFT from "fft.js";

const FFT_SIZE = 2048;
const HOP = FFT_SIZE / 4;
const COLA = 1.5; // Sum of Hann^2 with N/4 hop is ~1.5

function hannWindow(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  return w;
}

const HANN = hannWindow(FFT_SIZE);

// Apply Phase B FFT-based processing on an AudioBuffer.
// Returns a new AudioBuffer with same length / channel count / sample rate.
export async function applyFFTProcessing(audioBuffer, opts, onProgress) {
  if (!opts.phaseRand?.enabled && !opts.magJitter?.enabled) return audioBuffer;

  const fft = new FFT(FFT_SIZE);
  const sr = audioBuffer.sampleRate;
  const numCh = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const tmp = new Offline(numCh, length, sr);
  const out = tmp.createBuffer(numCh, length, sr);

  const frame = new Float32Array(FFT_SIZE);
  const spectrum = fft.createComplexArray();
  const ifftOut = fft.createComplexArray();
  const halfN = FFT_SIZE / 2;
  const phaseEnabled = !!opts.phaseRand?.enabled;
  const phaseAmount = opts.phaseRand?.amount ?? 1.0;
  const phaseHf = opts.phaseRand?.hfStartHz ?? 6000;
  const phaseHfBin = Math.floor((phaseHf / sr) * FFT_SIZE);
  const magEnabled = !!opts.magJitter?.enabled;
  const magDbRange = opts.magJitter?.dbRange ?? 0.4;

  let totalFrames = 0;
  for (let pos = 0; pos < length; pos += HOP) totalFrames++;

  for (let c = 0; c < numCh; c++) {
    const input = audioBuffer.getChannelData(c);
    const output = out.getChannelData(c);
    let fIdx = 0;

    for (let pos = 0; pos < length; pos += HOP) {
      // Windowed analysis frame
      for (let i = 0; i < FFT_SIZE; i++) {
        const idx = pos + i;
        frame[i] = idx < length ? input[idx] * HANN[i] : 0;
      }

      fft.realTransform(spectrum, frame);
      fft.completeSpectrum(spectrum);

      // Spectral processing
      for (let k = 1; k < halfN; k++) {
        const re = spectrum[2 * k];
        const im = spectrum[2 * k + 1];
        let mag = Math.sqrt(re * re + im * im);
        let phase = Math.atan2(im, re);

        let modified = false;
        if (phaseEnabled && k >= phaseHfBin) {
          phase += (Math.random() - 0.5) * Math.PI * 2 * phaseAmount;
          modified = true;
        }
        if (magEnabled) {
          const db = (Math.random() - 0.5) * 2 * magDbRange;
          mag *= Math.pow(10, db / 20);
          modified = true;
        }

        if (modified) {
          const newRe = mag * Math.cos(phase);
          const newIm = mag * Math.sin(phase);
          spectrum[2 * k] = newRe;
          spectrum[2 * k + 1] = newIm;
          // Hermitian conjugate for real signal reconstruction
          spectrum[2 * (FFT_SIZE - k)] = newRe;
          spectrum[2 * (FFT_SIZE - k) + 1] = -newIm;
        }
      }

      fft.inverseTransform(ifftOut, spectrum);

      // Synthesis window + overlap-add
      for (let i = 0; i < FFT_SIZE; i++) {
        const idx = pos + i;
        if (idx < length) output[idx] += (ifftOut[2 * i] / FFT_SIZE) * HANN[i];
      }

      fIdx++;
      if (fIdx % 60 === 0) {
        if (onProgress) onProgress((c + fIdx / totalFrames) / numCh);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // COLA normalisation
    for (let i = 0; i < length; i++) output[i] /= COLA;
  }

  return out;
}

// Build a short, exponentially-decaying random IR (a "small room" feel).
export function buildShortRoomIR(ctx, durationMs = 35, decay = 5.5) {
  const length = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const channels = 2;
  const ir = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-decay * t) * 0.6;
    }
    // Direct impulse spike
    data[0] = 0.85;
  }
  return ir;
}

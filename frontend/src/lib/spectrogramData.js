// Compute a magnitude (dB) spectrogram from an AudioBuffer for visualization.
// Uses overlap-add STFT (FFT size 1024, hop 512, Hann window).
import FFT from "fft.js";

const FFT_SIZE = 1024;
const HOP = 512;

function hann(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  return w;
}

const HANN = hann(FFT_SIZE);

// Returns: { width, height, data: Float32Array (height*width, dB), freqMaxHz, durationSec }
//   data[y * width + x] = dB magnitude where y=0 is top (highest freq) and y=height-1 is bottom (DC).
//   Range: typically [-80, 0]
export function computeSpectrogram(audioBuffer, opts = {}) {
  const maxFreqHz = opts.maxFreqHz ?? 12000;
  const sr = audioBuffer.sampleRate;
  const ch = audioBuffer.getChannelData(0); // mono only for spectrogram view
  const length = ch.length;
  const fft = new FFT(FFT_SIZE);

  const halfBins = FFT_SIZE / 2;
  const maxBin = Math.min(halfBins, Math.floor((maxFreqHz / sr) * FFT_SIZE));
  const numFrames = Math.max(1, Math.floor((length - FFT_SIZE) / HOP) + 1);

  const frame = new Float32Array(FFT_SIZE);
  const spectrum = fft.createComplexArray();

  // Down-sample width to keep canvas tidy
  const targetWidth = Math.min(numFrames, opts.targetWidth ?? 480);
  const heightTarget = Math.min(maxBin, opts.targetHeight ?? 220);
  const data = new Float32Array(targetWidth * heightTarget);

  // Pre-compute mapping
  const colsPerFrame = numFrames / targetWidth;

  for (let xt = 0; xt < targetWidth; xt++) {
    // Aggregate (max) frames in this column
    const frameStart = Math.floor(xt * colsPerFrame);
    const frameEnd = Math.max(frameStart + 1, Math.floor((xt + 1) * colsPerFrame));
    const colMax = new Float32Array(maxBin);

    for (let f = frameStart; f < frameEnd; f++) {
      const pos = f * HOP;
      for (let i = 0; i < FFT_SIZE; i++) {
        const idx = pos + i;
        frame[i] = idx < length ? ch[idx] * HANN[i] : 0;
      }
      fft.realTransform(spectrum, frame);
      // Don't need completeSpectrum for magnitude only
      for (let k = 0; k < maxBin; k++) {
        const re = spectrum[2 * k];
        const im = spectrum[2 * k + 1];
        const mag = Math.sqrt(re * re + im * im);
        if (mag > colMax[k]) colMax[k] = mag;
      }
    }

    // Down-sample bins to heightTarget rows (linear)
    const binsPerRow = maxBin / heightTarget;
    for (let yt = 0; yt < heightTarget; yt++) {
      // Top of canvas (yt=0) = highest freq, so flip
      const binIdx = Math.floor((heightTarget - 1 - yt) * binsPerRow);
      const binEnd = Math.max(binIdx + 1, Math.floor((heightTarget - yt) * binsPerRow));
      let m = 0;
      for (let b = binIdx; b < binEnd && b < maxBin; b++) {
        if (colMax[b] > m) m = colMax[b];
      }
      const db = 20 * Math.log10(Math.max(m, 1e-10));
      data[yt * targetWidth + xt] = db;
    }
  }

  return {
    width: targetWidth,
    height: heightTarget,
    data,
    freqMaxHz: (maxBin / FFT_SIZE) * sr,
    durationSec: length / sr,
  };
}

// Cyberpunk-tinted magma-ish colormap.
// t in [0,1] -> [r,g,b] 0..255.
export function colorMap(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0.0, 8, 4, 16],
    [0.15, 30, 8, 60],
    [0.35, 110, 20, 140],
    [0.55, 220, 60, 160],
    [0.7, 250, 130, 90],
    [0.85, 255, 210, 90],
    [1.0, 230, 250, 230],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t <= b[0]) {
      const k = (t - a[0]) / Math.max(1e-9, b[0] - a[0]);
      return [
        Math.round(a[1] + (b[1] - a[1]) * k),
        Math.round(a[2] + (b[2] - a[2]) * k),
        Math.round(a[3] + (b[3] - a[3]) * k),
      ];
    }
  }
  return [230, 250, 230];
}

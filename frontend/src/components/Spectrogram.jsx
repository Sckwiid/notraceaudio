import { useEffect, useRef } from "react";
import { computeSpectrogram, colorMap } from "../lib/spectrogramData";

export const Spectrogram = ({ audioBuffer, label, accent = "#22d3ee", glow = "#06b6d4", "data-testid": testId }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;

    if (!audioBuffer) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const targetWidth = Math.min(480, Math.floor(w / dpr));
    const targetHeight = Math.min(220, Math.floor(h / dpr));
    const { width, height, data } = computeSpectrogram(audioBuffer, { targetWidth, targetHeight, maxFreqHz: 12000 });

    // Build offscreen ImageData and stretch onto canvas
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    const img = offCtx.createImageData(width, height);

    // Map dB range to color (clamp to [-80, 0])
    const dbMin = -80;
    const dbMax = -10;
    for (let i = 0; i < data.length; i++) {
      const db = data[i];
      const t = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin)));
      const [r, g, b] = colorMap(t);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);

    // Stretch to canvas
    ctx.drawImage(off, 0, 0, w, h);
  }, [audioBuffer]);

  return (
    <div className="w-full" data-testid={testId}>
      {label && (
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${glow}` }} />
            {label}
          </div>
          <span className="text-zinc-600 normal-case tracking-normal">0–12 kHz</span>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-40 rounded-lg bg-black/60 border border-white/5" />
    </div>
  );
};

export default Spectrogram;

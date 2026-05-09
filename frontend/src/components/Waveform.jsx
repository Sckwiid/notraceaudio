import { useEffect, useRef } from "react";

export const Waveform = ({ peaks, color = "#22d3ee", glow = "#0ea5e9", label, "data-testid": testId }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, rect.height / 2 - 0.5, rect.width, 1);
      return;
    }

    const mid = rect.height / 2;
    const barWidth = rect.width / peaks.length;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * (rect.height * 0.9));
      ctx.fillRect(i * barWidth, mid - h / 2, Math.max(1, barWidth - 0.5), h);
    }
  }, [peaks, color, glow]);

  return (
    <div className="w-full" data-testid={testId}>
      {label && (
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${glow}` }} />
          {label}
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-24 rounded-lg bg-black/40 border border-white/5" />
    </div>
  );
};

export default Waveform;

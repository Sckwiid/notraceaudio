import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Sparkles, X, CheckCircle2, AlertCircle, FileAudio, Play } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { decodeAudioFile, processBuffer, randomiseSettings } from "../lib/audioProcessor";
import { audioBufferToWavBlob } from "../lib/wavEncoder";
import { audioBufferToMp3Blob } from "../lib/mp3Encoder";

const STATUS_LABEL = {
  queued: "En attente",
  decoding: "Décodage…",
  ready: "Prêt",
  processing: "Cleaning…",
  done: "Terminé",
  error: "Erreur",
};

export const BatchView = ({ files, settings, randomSeed, outputFormat, onReset, onAddMore }) => {
  const [tracks, setTracks] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);

  // Initialise tracks whenever input files change
  useEffect(() => {
    setTracks((prev) => {
      const existingByKey = new Map(prev.map((t) => [t.file.name + t.file.size, t]));
      return files.map((f) => {
        const k = f.name + f.size;
        return existingByKey.get(k) || {
          id: `${k}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          status: "queued",
          progress: 0,
          blobUrl: null,
          error: null,
        };
      });
    });
  }, [files]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      tracks.forEach((t) => {
        if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTrack = (id, patch) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const processOne = useCallback(
    async (track) => {
      try {
        updateTrack(track.id, { status: "decoding", progress: 0 });
        const buf = await decodeAudioFile(track.file);
        if (cancelRef.current) return;
        updateTrack(track.id, { status: "processing", progress: 5 });
        const effective = randomSeed ? randomiseSettings(settings) : settings;
        const out = await processBuffer(buf, effective, (p) => {
          updateTrack(track.id, { progress: Math.round(p * 100) });
        });
        if (cancelRef.current) return;
        const blob = outputFormat === "mp3" ? audioBufferToMp3Blob(out, 320) : audioBufferToWavBlob(out);
        const url = URL.createObjectURL(blob);
        updateTrack(track.id, { status: "done", progress: 100, blobUrl: url });
      } catch (e) {
        console.error(e);
        updateTrack(track.id, { status: "error", error: e.message || "Erreur inconnue" });
      }
    },
    [settings, randomSeed, outputFormat],
  );

  const runAll = async () => {
    cancelRef.current = false;
    setIsRunning(true);
    // Get fresh state for each iteration so we don't process already-done tracks
    for (const t of tracks) {
      if (cancelRef.current) break;
      if (t.status === "done") continue;
      // eslint-disable-next-line no-await-in-loop
      await processOne(t);
    }
    setIsRunning(false);
    if (!cancelRef.current) toast.success(`Batch terminé — ${tracks.filter((t) => t.status !== "error").length} fichiers nettoyés`);
  };

  const cancel = () => {
    cancelRef.current = true;
    setIsRunning(false);
  };

  const downloadOne = (track) => {
    if (!track.blobUrl) return;
    const a = document.createElement("a");
    a.href = track.blobUrl;
    const base = track.file.name.replace(/\.[^.]+$/, "");
    a.download = `${base}_clean.${outputFormat}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = () => {
    // Trigger downloads sequentially with small delay so browser doesn't block them
    const ready = tracks.filter((t) => t.status === "done" && t.blobUrl);
    ready.forEach((t, i) => setTimeout(() => downloadOne(t), i * 250));
  };

  const removeTrack = (id) => {
    setTracks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t?.blobUrl) URL.revokeObjectURL(t.blobUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const completedCount = tracks.filter((t) => t.status === "done").length;
  const errorCount = tracks.filter((t) => t.status === "error").length;
  const allDone = tracks.length > 0 && tracks.every((t) => t.status === "done" || t.status === "error");

  return (
    <div className="space-y-6" data-testid="batch-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-fuchsia-400/10 border border-fuchsia-400/30 px-3 py-1 text-xs font-mono text-fuchsia-200" data-testid="batch-mode-badge">
            BATCH MODE
          </span>
          <span className="text-zinc-300">
            {tracks.length} fichiers · <span className="text-cyan-300">{completedCount}</span> ok
            {errorCount > 0 && <> · <span className="text-rose-400">{errorCount}</span> err</>}
          </span>
        </div>
        <button onClick={onReset} className="text-xs text-zinc-500 hover:text-white transition">
          Réinitialiser
        </button>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1" data-testid="batch-list">
        {tracks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              t.status === "done"
                ? "border-cyan-400/30 bg-cyan-400/[0.03]"
                : t.status === "error"
                  ? "border-rose-400/30 bg-rose-400/[0.03]"
                  : "border-white/10 bg-black/30"
            }`}
            data-testid={`batch-track-${t.id}`}
          >
            <FileAudio className="h-4 w-4 shrink-0 text-zinc-400" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-white truncate">
                <span className="truncate">{t.file.name}</span>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">{(t.file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {(t.status === "decoding" || t.status === "processing") && (
                <div className="mt-1.5">
                  <Progress value={t.progress} className="h-1" />
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono">
                {t.status === "done" && <CheckCircle2 className="h-3 w-3 text-cyan-300" />}
                {t.status === "error" && <AlertCircle className="h-3 w-3 text-rose-400" />}
                <span className={t.status === "done" ? "text-cyan-300" : t.status === "error" ? "text-rose-400" : "text-zinc-500"}>
                  {STATUS_LABEL[t.status]}
                  {t.error && ` · ${t.error}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {t.status === "done" && (
                <Button size="sm" variant="outline" onClick={() => downloadOne(t)} className="border-white/10 bg-white/[0.03] hover:bg-white/10" data-testid={`batch-download-${t.id}`}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              {!isRunning && (
                <button
                  onClick={() => removeTrack(t.id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-white"
                  aria-label="Retirer"
                  data-testid={`batch-remove-${t.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {!isRunning ? (
          <Button
            onClick={runAll}
            disabled={tracks.length === 0 || allDone}
            className="flex-1 h-12 bg-cyan-400 text-black hover:bg-cyan-300 font-medium tracking-tight shadow-[0_0_30px_-8px_rgba(34,211,238,0.6)]"
            data-testid="batch-run-button"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Nettoyer tous les fichiers
          </Button>
        ) : (
          <Button onClick={cancel} variant="outline" className="flex-1 h-12 border-rose-400/40 text-rose-200 hover:bg-rose-400/10" data-testid="batch-cancel-button">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Annuler
          </Button>
        )}
        <Button
          onClick={downloadAll}
          disabled={completedCount === 0}
          variant="outline"
          className="h-12 border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
          data-testid="batch-downloadall-button"
        >
          <Download className="mr-2 h-4 w-4" /> Télécharger tous ({completedCount})
        </Button>
      </div>
    </div>
  );
};

export default BatchView;

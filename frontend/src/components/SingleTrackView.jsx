import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { Download, Loader2, Sparkles, RotateCcw, Eye } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Waveform } from "./Waveform";
import { Spectrogram } from "./Spectrogram";
import { ABBlindTest } from "./ABBlindTest";
import { decodeAudioFile, processBuffer, randomiseSettings, buildPeakData } from "../lib/audioProcessor";
import { audioBufferToWavBlob } from "../lib/wavEncoder";
import { audioBufferToMp3Blob } from "../lib/mp3Encoder";

export const SingleTrackView = ({ file, settings, randomSeed, outputFormat, onReset }) => {
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [originalPeaks, setOriginalPeaks] = useState(null);
  const [processedPeaks, setProcessedPeaks] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [abOpen, setAbOpen] = useState(false);
  const [showSpec, setShowSpec] = useState(true);

  // Decode whenever file changes
  useEffect(() => {
    let cancelled = false;
    if (!file) return;
    setIsDecoding(true);
    setProcessedBuffer(null);
    setProcessedUrl(null);
    setProcessedPeaks(null);
    decodeAudioFile(file)
      .then((buf) => {
        if (cancelled) return;
        setOriginalBuffer(buf);
        setOriginalPeaks(buildPeakData(buf, 600));
        const url = URL.createObjectURL(file);
        setOriginalUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((err) => {
        console.error(err);
        toast.error("Impossible de décoder ce fichier audio.");
      })
      .finally(() => !cancelled && setIsDecoding(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleProcess = useCallback(async () => {
    if (!originalBuffer) return;
    setIsProcessing(true);
    setProgress(0);
    try {
      const effective = randomSeed ? randomiseSettings(settings) : settings;
      const out = await processBuffer(originalBuffer, effective, (p) => setProgress(Math.round(p * 100)));
      setProcessedBuffer(out);
      setProcessedPeaks(buildPeakData(out, 600));
      const blob = outputFormat === "mp3" ? audioBufferToMp3Blob(out, 320) : audioBufferToWavBlob(out);
      const url = URL.createObjectURL(blob);
      setProcessedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      toast.success(randomSeed ? "Cleaned · seed aléatoire — sortie unique" : "Watermark retiré · prêt à télécharger");
    } catch (e) {
      console.error(e);
      toast.error("Erreur durant le traitement.");
    } finally {
      setIsProcessing(false);
    }
  }, [originalBuffer, settings, randomSeed, outputFormat]);

  const handleDownload = () => {
    if (!processedUrl || !file) return;
    const a = document.createElement("a");
    a.href = processedUrl;
    const base = file.name.replace(/\.[^.]+$/, "");
    a.download = `${base}_clean.${outputFormat}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const duration = useMemo(() => {
    if (!originalBuffer) return null;
    const s = originalBuffer.duration;
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [originalBuffer]);

  return (
    <div className="space-y-6" data-testid="audio-section">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="text-cyan-300">{originalBuffer?.numberOfChannels === 1 ? "MONO" : "STEREO"}</span>
          <span>·</span>
          <span>{originalBuffer?.sampleRate} Hz</span>
          {duration && <><span>·</span><span>{duration}</span></>}
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition"
          data-testid="reset-button"
        >
          <RotateCcw className="h-3 w-3" /> Réinitialiser
        </button>
      </div>

      {isDecoding ? (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Décodage en cours…
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <Waveform peaks={originalPeaks} color="#71717a" glow="#52525b" label="Original · waveform" data-testid="waveform-original" />
            {showSpec && (
              <Spectrogram audioBuffer={originalBuffer} label="Original · spectrogram" accent="#71717a" glow="#52525b" data-testid="spectrogram-original" />
            )}
            {originalUrl && <audio src={originalUrl} controls className="w-full" data-testid="audio-original" />}
          </div>

          {processedUrl && (
            <div className="space-y-4 pt-2">
              <Waveform peaks={processedPeaks} color="#22d3ee" glow="#06b6d4" label="Cleaned · waveform" data-testid="waveform-processed" />
              {showSpec && (
                <Spectrogram audioBuffer={processedBuffer} label="Cleaned · spectrogram" accent="#22d3ee" glow="#06b6d4" data-testid="spectrogram-processed" />
              )}
              <audio src={processedUrl} controls className="w-full" data-testid="audio-processed" />
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2" data-testid="processing-indicator">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Rendering offline…</span>
                <span className="text-cyan-300">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleProcess}
              disabled={!originalBuffer || isProcessing}
              className="flex-1 h-12 bg-cyan-400 text-black hover:bg-cyan-300 font-medium tracking-tight shadow-[0_0_30px_-8px_rgba(34,211,238,0.6)]"
              data-testid="process-button"
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Lancer le nettoyage</>
              )}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!processedUrl}
              variant="outline"
              className="h-12 border-white/10 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"
              data-testid="download-button"
            >
              <Download className="mr-2 h-4 w-4" /> Télécharger {outputFormat.toUpperCase()}
            </Button>
            <Button
              onClick={() => setAbOpen(true)}
              disabled={!processedUrl}
              variant="outline"
              className="h-12 border-fuchsia-400/30 bg-fuchsia-400/5 text-fuchsia-200 hover:bg-fuchsia-400/10 hover:text-fuchsia-100"
              data-testid="ab-button"
            >
              <Eye className="mr-2 h-4 w-4" /> A/B Blind Test
            </Button>
          </div>

          <ABBlindTest open={abOpen} onOpenChange={setAbOpen} originalUrl={originalUrl} processedUrl={processedUrl} />
        </>
      )}
    </div>
  );
};

export default SingleTrackView;

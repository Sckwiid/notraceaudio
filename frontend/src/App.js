import { useState } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { Sparkles, ShieldCheck, Waves, Zap, Github, AudioWaveform, Dices, Layers } from "lucide-react";
import { Switch } from "./components/ui/switch";
import { Label } from "./components/ui/label";
import { Dropzone } from "./components/Dropzone";
import { SettingsPanel } from "./components/SettingsPanel";
import { SingleTrackView } from "./components/SingleTrackView";
import { BatchView } from "./components/BatchView";
import { getPreset } from "./lib/audioProcessor";

function App() {
  const [files, setFiles] = useState([]);
  const [preset, setPreset] = useState("standard");
  const [settings, setSettings] = useState(getPreset("standard"));
  const [randomSeed, setRandomSeed] = useState(false);
  const [outputFormat, setOutputFormat] = useState("wav");

  const handleFiles = (newFiles) => {
    // Single click: replace; if multiple files, switch to batch
    if (newFiles.length === 1 && files.length === 0) {
      setFiles(newFiles);
    } else {
      // Append unique by name+size
      setFiles((prev) => {
        const seen = new Set(prev.map((f) => f.name + f.size));
        const merged = [...prev];
        for (const f of newFiles) {
          const k = f.name + f.size;
          if (!seen.has(k)) merged.push(f);
        }
        return merged;
      });
    }
  };

  const reset = () => setFiles([]);

  const isBatch = files.length > 1;
  const single = files.length === 1 ? files[0] : null;

  return (
    <div className="min-h-screen w-full text-white relative overflow-hidden">
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-noise" />

      <Toaster theme="dark" position="top-center" />

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10">
            <AudioWaveform className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="font-display text-base sm:text-lg tracking-tight">
            <span className="text-white">unmark</span><span className="text-cyan-400">.</span><span className="text-zinc-400">audio</span>
          </div>
        </div>
        <a
          href="https://github.com/geeknik/ai-audio-fingerprint-remover"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-300 hover:border-white/30 hover:text-white transition"
          data-testid="github-link"
        >
          <Github className="h-3.5 w-3.5" /> Source originale
        </a>
      </header>

      <section className="relative z-10 px-6 sm:px-10 pt-6 sm:pt-12 pb-10">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-mono">
            <Sparkles className="h-3 w-3" /> 100 % local · zéro upload
          </div>
          <h1 className="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            Retire les watermarks<br />
            des musiques générées par <span className="text-cyan-300 italic">IA</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
            FFT phase randomization · resample chain · pitch+time shift · convolution · M/S decorrelation · pink noise floor · codec round-trip · spectrogram visualizer · A/B blind test · batch processing · strip metadata.
            Tout dans ton navigateur via Web Audio API. Aucun fichier ne quitte ton appareil.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-mono">
            <Feature icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Privé par design" />
            <Feature icon={<Waves className="h-3.5 w-3.5" />} text="Suno · ElevenLabs · OpenAI" />
            <Feature icon={<Layers className="h-3.5 w-3.5" />} text="Mode batch" />
            <Feature icon={<Zap className="h-3.5 w-3.5" />} text="Optimisé mobile" />
          </div>
        </div>
      </section>

      <main className="relative z-10 px-6 sm:px-10 pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass-card p-6 sm:p-8">
            <Dropzone onFiles={handleFiles} file={single} count={files.length} multiple={true} />

            {/* Render options strip — common to both views */}
            {files.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-4" data-testid="render-options">
                <FormatToggle value={outputFormat} onChange={setOutputFormat} />
                <div className="ml-auto flex items-center gap-3">
                  <Dices className={`h-4 w-4 ${randomSeed ? "text-fuchsia-300" : "text-zinc-500"}`} />
                  <Label htmlFor="random-seed" className="text-xs text-zinc-300">Random Seed</Label>
                  <Switch id="random-seed" checked={randomSeed} onCheckedChange={setRandomSeed} data-testid="toggle-random-seed" />
                </div>
              </div>
            )}

            {single && (
              <div className="mt-8">
                <SingleTrackView
                  file={single}
                  settings={settings}
                  randomSeed={randomSeed}
                  outputFormat={outputFormat}
                  onReset={reset}
                />
              </div>
            )}

            {isBatch && (
              <div className="mt-8">
                <BatchView
                  files={files}
                  settings={settings}
                  randomSeed={randomSeed}
                  outputFormat={outputFormat}
                  onReset={reset}
                />
              </div>
            )}
          </div>

          <aside className="glass-card p-6 sm:p-8">
            <h2 className="font-display text-xl mb-1">Paramètres</h2>
            <p className="text-xs text-zinc-500 mb-6">
              {isBatch ? "Appliqué à tous les fichiers du batch." : "Choisis un preset ou affine chaque module manuellement."}
            </p>
            <SettingsPanel settings={settings} setSettings={setSettings} preset={preset} setPreset={setPreset} />
          </aside>
        </div>

        <section className="mt-16">
          <h3 className="font-display text-2xl mb-6">Pipeline anti-détection</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Step n="01" title="FFT phase rand." desc="STFT 2048 / Hann / hop ¼ — randomise la phase au-dessus de 6 kHz, casse la cohérence du codec neuronal." />
            <Step n="02" title="Magnitude jitter" desc="Variation aléatoire ±0.4 dB par bin FFT — détruit les patterns de quantification." />
            <Step n="03" title="Pitch + time shift" desc="playbackRate ±cents — décale toutes les empreintes spectrales apprises." />
            <Step n="04" title="Time-warping" desc="Vibrato de tempo aléatoire ±0.3 % — casse la régularité parfaite des onsets." />
            <Step n="05" title="Resample chain" desc="44.1 → 47983 → 44.1 kHz : brouille la position sub-échantillon des artefacts." />
            <Step n="06" title="Filtres + tape sat" desc="Low-pass + notch Suno + tanh saturation — harmoniques analogiques." />
            <Step n="07" title="Convolution + decorr" desc="IR de pièce courte + délai stéréo R ~80 µs — cue acoustique d'enregistrement." />
            <Step n="08" title="Codec round-trip" desc="Re-encode MP3 320 kbps puis re-décode — appose une signature codec lossy naturelle." />
            <Step n="09" title="Pink noise + dither" desc="Bruit rose -65 dB Voss-McCartney + dithering triangulaire sub-audible." />
            <Step n="10" title="Spectrogram view" desc="Affiche les bandes nettoyées avant/après pour une preuve visuelle." />
            <Step n="11" title="A/B blind test" desc="Identifie le cleaned au hasard — score < 60 % = transparent." />
            <Step n="12" title="Batch + Random Seed" desc="Plusieurs fichiers en une fois · paramètres randomisés à chaque run." />
          </div>
        </section>

        <footer className="mt-20 pt-8 border-t border-white/5 text-center text-xs text-zinc-500 font-mono">
          unmark.audio — built with <span className="text-cyan-400">♢</span> for music creators ·
          inspired by <a className="text-cyan-400 hover:underline" href="https://github.com/geeknik/ai-audio-fingerprint-remover" target="_blank" rel="noreferrer">geeknik/ai-audio-fingerprint-remover</a>
        </footer>
      </main>
    </div>
  );
}

const FormatToggle = ({ value, onChange }) => (
  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1" data-testid="format-toggle">
    {["wav", "mp3"].map((fmt) => (
      <button
        key={fmt}
        type="button"
        onClick={() => onChange(fmt)}
        data-testid={`format-${fmt}`}
        className={`rounded-full px-3 py-1 text-xs font-mono transition ${
          value === fmt ? "bg-cyan-400 text-black" : "text-zinc-400 hover:text-white"
        }`}
      >
        {fmt.toUpperCase()}
      </button>
    ))}
  </div>
);

const Feature = ({ icon, text }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
    <span className="text-cyan-300">{icon}</span>
    {text}
  </span>
);

const Step = ({ n, title, desc }) => (
  <div className="glass-card p-5">
    <div className="font-mono text-xs text-cyan-400">{n}</div>
    <div className="mt-2 font-display text-lg">{title}</div>
    <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);

export default App;

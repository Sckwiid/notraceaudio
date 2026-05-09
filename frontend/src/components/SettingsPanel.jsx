import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { ShieldCheck } from "lucide-react";
import { PRESET_NAMES, getPreset } from "../lib/audioProcessor";

const PRESET_LABELS = {
  light: { name: "Light", desc: "Discret · qualité max" },
  standard: { name: "Standard", desc: "Recommandé" },
  aggressive: { name: "Aggressive", desc: "Protection forte" },
  stealth: { name: "Stealth", desc: "Anti-détection max", icon: true },
};

export const SettingsPanel = ({ settings, setSettings, preset, setPreset }) => {
  const update = (path, value) => {
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const applyPreset = (name) => {
    setPreset(name);
    setSettings(getPreset(name));
  };

  return (
    <div className="space-y-6" data-testid="settings-panel">
      <div>
        <p className="mb-3 text-xs uppercase tracking-[0.25em] text-zinc-500 font-mono">Preset</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_NAMES.map((name) => {
            const isStealth = name === "stealth";
            const active = preset === name;
            return (
              <button
                key={name}
                type="button"
                data-testid={`preset-${name}`}
                onClick={() => applyPreset(name)}
                className={`group rounded-xl border px-3 py-3 text-left transition-all ${
                  active
                    ? isStealth
                      ? "border-fuchsia-400/60 bg-fuchsia-400/10 shadow-[0_0_30px_-12px_rgba(232,121,249,0.7)]"
                      : "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_30px_-12px_rgba(34,211,238,0.6)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isStealth && (
                    <ShieldCheck className={`h-3.5 w-3.5 ${active ? "text-fuchsia-300" : "text-fuchsia-400/70"}`} />
                  )}
                  <div className="text-sm font-medium capitalize text-white">{PRESET_LABELS[name].name}</div>
                </div>
                <div className="mt-1 text-[11px] leading-tight text-zinc-500">{PRESET_LABELS[name].desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <Section title="Filtres spectraux">
        <ToggleRow
          testId="toggle-lowpass"
          label="Filtre passe-bas"
          hint="Coupe les watermarks ultrasoniques"
          checked={settings.lowpass.enabled}
          onChange={(v) => update("lowpass.enabled", v)}
        />
        {settings.lowpass.enabled && (
          <SliderRow
            testId="slider-cutoff"
            label="Fréquence de coupure"
            value={settings.lowpass.cutoff}
            min={10000}
            max={21000}
            step={100}
            unit="Hz"
            onChange={(v) => update("lowpass.cutoff", v)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-notches"
          label="Notch (bandes Suno)"
          hint="Élimine 16/17/18/19 kHz"
          checked={settings.notches.enabled}
          onChange={(v) => update("notches.enabled", v)}
        />
        <Divider />
        <ToggleRow
          testId="toggle-highshelf"
          label="High-shelf reduction"
          hint="Atténue les hautes fréquences"
          checked={settings.highShelf.enabled}
          onChange={(v) => update("highShelf.enabled", v)}
        />
        {settings.highShelf.enabled && (
          <SliderRow
            testId="slider-shelf-gain"
            label="Gain"
            value={settings.highShelf.gain}
            min={-15}
            max={0}
            step={1}
            unit="dB"
            onChange={(v) => update("highShelf.gain", v)}
          />
        )}
      </Section>

      <Section title="Anti-détection · Phase A" badge="STEALTH">
        <ToggleRow
          testId="toggle-pitchtime"
          label="Pitch + time micro-shift"
          hint="Décale toutes les fréquences (±cents)"
          checked={settings.pitchTime?.enabled || false}
          onChange={(v) => update("pitchTime.enabled", v)}
        />
        {settings.pitchTime?.enabled && (
          <SliderRow
            testId="slider-ratepct"
            label="Amplitude"
            value={Math.round((settings.pitchTime.ratePct || 0.6) * 10)}
            min={2}
            max={20}
            step={1}
            unit="‰"
            onChange={(v) => update("pitchTime.ratePct", v / 10)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-resamplechain"
          label="Resample chain (47983 Hz)"
          hint="Brouille la position des artefacts neuronaux"
          checked={settings.resampleChain?.enabled || false}
          onChange={(v) => update("resampleChain.enabled", v)}
        />
        <Divider />
        <ToggleRow
          testId="toggle-tape"
          label="Tape saturation"
          hint="Harmoniques analogiques douces"
          checked={settings.tapeSaturation?.enabled || false}
          onChange={(v) => update("tapeSaturation.enabled", v)}
        />
        {settings.tapeSaturation?.enabled && (
          <SliderRow
            testId="slider-drive"
            label="Drive"
            value={Math.round((settings.tapeSaturation.drive || 1.05) * 100)}
            min={101}
            max={120}
            step={1}
            unit=""
            onChange={(v) => update("tapeSaturation.drive", v / 100)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-pinknoise"
          label="Pink noise floor"
          hint="Imite le bruit d'enregistrement réel"
          checked={settings.pinkNoiseFloor?.enabled || false}
          onChange={(v) => update("pinkNoiseFloor.enabled", v)}
        />
        {settings.pinkNoiseFloor?.enabled && (
          <SliderRow
            testId="slider-pinklevel"
            label="Niveau"
            value={settings.pinkNoiseFloor.levelDb || -65}
            min={-80}
            max={-50}
            step={1}
            unit="dB"
            onChange={(v) => update("pinkNoiseFloor.levelDb", v)}
          />
        )}
      </Section>

      <Section title="Anti-détection · Phase B" badge="FFT">
        <ToggleRow
          testId="toggle-phaserand"
          label="Phase randomization HF"
          hint="Casse la cohérence de phase du codec neuronal"
          checked={settings.phaseRand?.enabled || false}
          onChange={(v) => update("phaseRand.enabled", v)}
        />
        {settings.phaseRand?.enabled && (
          <SliderRow
            testId="slider-phasehf"
            label="Fréquence de départ"
            value={settings.phaseRand.hfStartHz || 6000}
            min={3000}
            max={10000}
            step={100}
            unit="Hz"
            onChange={(v) => update("phaseRand.hfStartHz", v)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-magjitter"
          label="Spectral magnitude jitter"
          hint="Casse les patterns de quantification"
          checked={settings.magJitter?.enabled || false}
          onChange={(v) => update("magJitter.enabled", v)}
        />
        {settings.magJitter?.enabled && (
          <SliderRow
            testId="slider-magdb"
            label="Plage"
            value={Math.round((settings.magJitter.dbRange || 0.4) * 10)}
            min={1}
            max={10}
            step={1}
            unit="·0.1 dB"
            onChange={(v) => update("magJitter.dbRange", v / 10)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-timewarp"
          label="Micro time-warping"
          hint="Vibrato de tempo aléatoire ±0.3 %"
          checked={settings.timeWarp?.enabled || false}
          onChange={(v) => update("timeWarp.enabled", v)}
        />
        {settings.timeWarp?.enabled && (
          <SliderRow
            testId="slider-warpdepth"
            label="Profondeur"
            value={Math.round((settings.timeWarp.depthPct || 0.25) * 100)}
            min={5}
            max={60}
            step={1}
            unit="·0.01 %"
            onChange={(v) => update("timeWarp.depthPct", v / 100)}
          />
        )}
      </Section>

      <Section title="Anti-détection · Phase C" badge="ROOM">
        <ToggleRow
          testId="toggle-convolution"
          label="Short-IR convolution"
          hint="Ajoute un indice acoustique de pièce courte"
          checked={settings.convolution?.enabled || false}
          onChange={(v) => update("convolution.enabled", v)}
        />
        {settings.convolution?.enabled && (
          <SliderRow
            testId="slider-convmix"
            label="Mix"
            value={Math.round((settings.convolution.mix || 0.1) * 100)}
            min={2}
            max={30}
            step={1}
            unit="%"
            onChange={(v) => update("convolution.mix", v / 100)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-stereodecorr"
          label="Stereo M/S decorrelation"
          hint="Brise la cohérence stéréo parfaite"
          checked={settings.stereoDecorr?.enabled || false}
          onChange={(v) => update("stereoDecorr.enabled", v)}
        />
        {settings.stereoDecorr?.enabled && (
          <SliderRow
            testId="slider-stereodelay"
            label="Délai R"
            value={settings.stereoDecorr.delayUs || 80}
            min={20}
            max={200}
            step={5}
            unit="µs"
            onChange={(v) => update("stereoDecorr.delayUs", v)}
          />
        )}
        <Divider />
        <ToggleRow
          testId="toggle-codecroundtrip"
          label="Codec round-trip MP3"
          hint="Re-encode MP3 puis re-décode pour signature codec naturelle"
          checked={settings.codecRoundTrip?.enabled || false}
          onChange={(v) => update("codecRoundTrip.enabled", v)}
        />
      </Section>

      <Section title="Dithering">
        <ToggleRow
          testId="toggle-dither"
          label="Dithering bruit"
          hint="Masque les fingerprints d'absence"
          checked={settings.dither.enabled}
          onChange={(v) => update("dither.enabled", v)}
        />
        {settings.dither.enabled && (
          <SliderRow
            testId="slider-dither"
            label="Intensité"
            value={Math.round(settings.dither.amount * 10000)}
            min={1}
            max={50}
            step={1}
            unit=""
            onChange={(v) => update("dither.amount", v / 10000)}
          />
        )}
      </Section>
    </div>
  );
};

const Section = ({ title, badge, children }) => (
  <div className="space-y-5 rounded-xl border border-white/10 bg-black/30 p-5">
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-[0.25em] text-zinc-400 font-mono">{title}</p>
      {badge && (
        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[9px] tracking-[0.2em] text-fuchsia-300 font-mono">
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

const Divider = () => <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />;

const ToggleRow = ({ label, hint, checked, onChange, testId }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <Label className="text-sm text-white">{label}</Label>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
  </div>
);

const SliderRow = ({ label, value, min, max, step, unit, onChange, testId }) => (
  <div data-testid={testId}>
    <div className="mb-2 flex items-center justify-between">
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <span className="font-mono text-xs text-cyan-300">
        {value}
        {unit && ` ${unit}`}
      </span>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
  </div>
);

export default SettingsPanel;

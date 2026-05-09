import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileAudio, Layers } from "lucide-react";

const ACCEPTED_EXT = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"];

const isAudioFile = (f) => {
  const lower = f.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
};

export const Dropzone = ({ onFiles, file, count = 0, multiple = true }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (list) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list).filter(isAudioFile);
      if (files.length === 0) {
        alert("Format non supporté. Utilise MP3, WAV, FLAC, OGG, M4A ou AAC.");
        return;
      }
      onFiles(files);
    },
    [onFiles],
  );

  const showsBatch = count > 1;

  return (
    <div
      data-testid="dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border border-dashed p-10 sm:p-14 text-center transition-all duration-300 backdrop-blur-xl ${
        drag
          ? "border-cyan-300 bg-cyan-400/5 shadow-[0_0_60px_-10px_rgba(34,211,238,0.45)]"
          : "border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-400/[0.03]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={ACCEPTED_EXT.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        data-testid="file-input"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-black/40">
          {showsBatch ? (
            <Layers className="h-6 w-6 text-fuchsia-300" />
          ) : file ? (
            <FileAudio className="h-6 w-6 text-cyan-300" />
          ) : (
            <UploadCloud className="h-6 w-6 text-cyan-300" />
          )}
        </div>
        {showsBatch ? (
          <div>
            <p className="font-mono text-sm text-fuchsia-200" data-testid="batch-count">
              {count} fichiers en batch
            </p>
            <p className="mt-1 text-xs text-zinc-500">Clique pour ajouter d'autres fichiers</p>
          </div>
        ) : file ? (
          <div>
            <p className="font-mono text-sm text-cyan-200" data-testid="selected-file-name">{file.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB · clique pour changer</p>
          </div>
        ) : (
          <div>
            <p className="text-lg sm:text-xl font-medium text-white">
              Dépose tes fichiers audio<span className="text-cyan-300">.</span>
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              MP3 · WAV · FLAC · OGG · M4A · AAC — {multiple ? "1 ou plusieurs fichiers · " : ""}<span className="text-cyan-300">100 % local</span>, rien n'est envoyé.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropzone;

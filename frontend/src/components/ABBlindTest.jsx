import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Eye, Trophy, RotateCcw } from "lucide-react";

// A/B blind test. Two unlabelled audio sources are presented in random order;
// the user has to identify the cleaned one. Tracks score across rounds.
export const ABBlindTest = ({ open, onOpenChange, originalUrl, processedUrl }) => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [revealed, setRevealed] = useState(null); // null | "A" | "B"
  const [pickedSide, setPickedSide] = useState(null);

  // Each new round, randomise which side hosts the cleaned track.
  const layout = useMemo(() => {
    const cleanedOnA = Math.random() < 0.5;
    return {
      A: cleanedOnA ? processedUrl : originalUrl,
      B: cleanedOnA ? originalUrl : processedUrl,
      cleanedSide: cleanedOnA ? "A" : "B",
    };
  }, [round, originalUrl, processedUrl]);

  useEffect(() => {
    if (!open) {
      setRevealed(null);
      setPickedSide(null);
    }
  }, [open]);

  const guess = (side) => {
    if (revealed) return;
    setPickedSide(side);
    setRevealed(layout.cleanedSide);
    setScore((s) => ({
      correct: s.correct + (side === layout.cleanedSide ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const next = () => {
    setRevealed(null);
    setPickedSide(null);
    setRound((r) => r + 1);
  };

  const reset = () => {
    setScore({ correct: 0, total: 0 });
    setRevealed(null);
    setPickedSide(null);
    setRound((r) => r + 1);
  };

  const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const verdict = (() => {
    if (score.total < 3) return null;
    if (accuracy <= 60) return { label: "Indiscernable", tone: "good", desc: "Tu devines au hasard → le cleaning est transparent." };
    if (accuracy <= 80) return { label: "Subtil", tone: "ok", desc: "Tu sens la différence sans certitude." };
    return { label: "Détectable", tone: "bad", desc: "Le cleaning s'entend — réduis l'aggressivité." };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-xl" data-testid="ab-blind-test-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">A/B Blind Test</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Écoute les deux extraits et identifie le <span className="text-cyan-300">cleaned</span>. Plus ton score est proche de 50 %, plus le nettoyage est transparent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {[
            { side: "A", url: layout.A },
            { side: "B", url: layout.B },
          ].map(({ side, url }) => {
            const isCleaned = revealed === side;
            const isPicked = pickedSide === side;
            return (
              <div
                key={side}
                className={`rounded-xl border p-4 transition-all ${
                  revealed
                    ? isCleaned
                      ? "border-cyan-400/60 bg-cyan-400/5"
                      : "border-zinc-700 bg-black/40"
                    : isPicked
                      ? "border-fuchsia-400/40 bg-fuchsia-400/5"
                      : "border-white/10 bg-black/30"
                }`}
                data-testid={`ab-card-${side}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-zinc-300">Sample {side}</span>
                  {revealed && (
                    <span className={`text-[11px] font-mono ${isCleaned ? "text-cyan-300" : "text-zinc-500"}`}>
                      {isCleaned ? "CLEANED" : "ORIGINAL"}
                    </span>
                  )}
                </div>
                <audio src={url} controls className="w-full" data-testid={`ab-audio-${side}`} />
                <Button
                  className="mt-3 w-full bg-white/5 text-white hover:bg-white/10 border border-white/10"
                  onClick={() => guess(side)}
                  disabled={!!revealed}
                  data-testid={`ab-pick-${side}`}
                >
                  <Eye className="h-3.5 w-3.5 mr-2" /> Je pense que c'est ça
                </Button>
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-4 w-4 text-cyan-300" />
              <div>
                <div className="text-sm" data-testid="ab-score">
                  {score.correct} / {score.total}
                </div>
                {verdict && (
                  <div
                    className={`text-[11px] font-mono ${
                      verdict.tone === "good" ? "text-cyan-300" : verdict.tone === "ok" ? "text-amber-300" : "text-rose-300"
                    }`}
                    data-testid="ab-verdict"
                  >
                    {verdict.label} — {verdict.desc}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="border-white/10 bg-white/5 text-white hover:bg-white/10" data-testid="ab-reset">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
              <Button size="sm" onClick={next} disabled={!revealed} className="bg-cyan-400 text-black hover:bg-cyan-300" data-testid="ab-next">
                Round suivant
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ABBlindTest;

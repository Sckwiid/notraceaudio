import { useEffect, useState } from "react";
import { KeyRound, Mail, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const CONTACT_EMAIL = process.env.REACT_APP_CONTACT_EMAIL || "contact@notraceaudio.com";
const QUOTA_REQUESTS = ["20/jour", "100/jour", "illimité"];

function formatQuota(quotaDaily) {
  return quotaDaily === null ? "Illimité" : `${quotaDaily}/jour`;
}

function buildContactHref(quota) {
  const subject = encodeURIComponent(`Demande quota No Trace Audio - ${quota}`);
  const body = encodeURIComponent(
    [
      "Bonjour,",
      "",
      `Je souhaite débloquer un quota ${quota} pour No Trace Audio.`,
      "",
      "Email :",
      "Usage prévu :",
      "Volume approximatif :",
      "",
      "Merci.",
    ].join("\n"),
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export const QuotaPanel = ({ enabled, status, activeCode, loading, onRefresh, onSaveCode }) => {
  const [draftCode, setDraftCode] = useState(activeCode || "");

  useEffect(() => {
    setDraftCode(activeCode || "");
  }, [activeCode]);

  if (!enabled) {
    return (
      <div className="w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
        API quota non configurée (`REACT_APP_QUOTA_API_URL`) : le nettoyage reste en accès libre.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-white/10 bg-black/40 p-3" data-testid="quota-panel">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 font-mono uppercase tracking-wide text-cyan-200">
          {status.tier}
        </span>
        <span className="text-zinc-400">
          Utilisé {status.usedToday} · Restant {status.remaining === null ? "∞" : status.remaining} · Limite {formatQuota(status.quotaDaily)}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto inline-flex items-center gap-1 text-zinc-400 hover:text-white"
          data-testid="quota-refresh"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
            placeholder="NTA-PRO-XXXX"
            className="h-9 border-white/15 bg-white/5 pl-8 text-xs font-mono text-white placeholder:text-zinc-500"
            data-testid="quota-code-input"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-white/15 bg-white/[0.03] text-xs text-white hover:bg-white/10"
          onClick={() => onSaveCode(draftCode)}
          data-testid="quota-code-save"
        >
          Enregistrer le code
        </Button>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
        <ShieldAlert className="h-3 w-3" />
        Sans code : 3 nettoyages par jour et par IP.
      </p>

      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-300">
            <Mail className="h-3.5 w-3.5 text-cyan-300" />
            Demander plus de quota
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {QUOTA_REQUESTS.map((quota) => (
              <a
                key={quota}
                href={buildContactHref(quota)}
                className="rounded-md border border-white/15 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-200"
                data-testid={`quota-request-${quota}`}
              >
                {quota}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaPanel;

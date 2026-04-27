import { X, TrendingDown, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { driftAlerts } from "@/data/mock";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenReconstruction: (id: string) => void;
}

export default function NotificationDrawer({ open, onClose, onOpenReconstruction }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm anim-fade-in"
        onClick={onClose}
      />
      <aside className="anim-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <div className="hairline-bottom flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-serif-display text-xl text-foreground">Drift alerts</h2>
            <p className="font-mono-plex mt-0.5 text-[10px] uppercase tracking-[0.2em] text-foreground-faint">
              {driftAlerts.length} active
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {driftAlerts.map((alert, i) => (
            <button
              key={alert.id}
              onClick={() => {
                onClose();
                onOpenReconstruction(alert.reconstructionId);
              }}
              className={`group flex w-full items-start gap-3 px-6 py-5 text-left transition-colors hover:bg-surface ${
                i !== driftAlerts.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-status-weak/40 bg-status-weak/10">
                <TrendingDown className="h-3 w-3 text-status-weak" />
              </span>
              <div className="flex-1">
                <h3 className="text-[14px] font-medium text-foreground">{alert.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground-dim">{alert.detail}</p>
                <span className="font-mono-plex mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary">
                  View reconstruction
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

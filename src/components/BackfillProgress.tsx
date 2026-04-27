import { platformStats } from "@/data/mock";

export default function BackfillProgress() {
  const pct = Math.round((platformStats.backfill.processed / platformStats.backfill.total) * 100);
  return (
    <section className="anim-fade-up surface-card rounded-lg p-5" style={{ animationDelay: "360ms" }}>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Building your artifact base
        </h3>
        <span className="font-mono-plex text-[11px] text-foreground-dim">{pct}%</span>
      </div>
      <p className="mb-3 text-sm text-foreground-dim">
        Processed{" "}
        <span className="font-mono-plex text-foreground">
          {platformStats.backfill.processed.toLocaleString()}
        </span>{" "}
        of ~
        <span className="font-mono-plex">
          {platformStats.backfill.total.toLocaleString()}
        </span>{" "}
        historical items. Reconstructions become more complete as backfill progresses.
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="anim-expand-line h-full bg-gradient-to-r from-primary to-primary-glow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

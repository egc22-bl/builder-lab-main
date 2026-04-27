import type { Reconstruction, TimelineNode } from "@/data/mock";

const kindMeta: Record<TimelineNode["kind"], { label: string; color: string }> = {
  spike: { label: "Spike", color: "text-status-weak" },
  gate: { label: "Gate", color: "text-status-moderate" },
  patch: { label: "Patch", color: "text-status-info" },
  "weak-signal": { label: "Weak signal", color: "text-foreground-muted" },
  deferral: { label: "Deferral", color: "text-foreground-muted" },
};

export default function EvolutionLayer({ r }: { r: Reconstruction }) {
  return (
    <section id="evolution" className="anim-fade-up">
      <h2 className="font-mono-plex mb-5 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        Evolution and patterns
      </h2>

      <div className="surface-card rounded-lg p-6 md:p-8">
        <ol className="relative space-y-6 pl-7">
          <span
            aria-hidden
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border-strong to-transparent"
          />
          {r.timeline.map((n, i) => {
            const m = kindMeta[n.kind];
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                  n.kind === "spike" ? "bg-status-weak" :
                  n.kind === "gate" ? "bg-status-moderate" :
                  n.kind === "patch" ? "bg-status-info" :
                  "bg-foreground-faint"
                }`} />
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono-plex text-[11px] uppercase tracking-[0.15em] text-foreground-muted">
                    {n.date}
                  </span>
                  <span className={`font-mono-plex text-[10px] uppercase tracking-[0.18em] ${m.color}`}>
                    {m.label}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-foreground">{n.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground-dim">{n.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-8">
        <h3 className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Repeated patterns
        </h3>
        <div className="space-y-3">
          {r.patterns.map((p, i) => (
            <div key={i} className="surface-card grid gap-0 overflow-hidden rounded-lg md:grid-cols-2">
              <div className="border-b border-border p-5 md:border-b-0 md:border-r">
                <span className="font-mono-plex mb-2 block text-[10px] uppercase tracking-[0.2em] text-status-info">
                  Fact
                </span>
                <p className="text-[14px] leading-relaxed text-foreground-dim">{p.fact}</p>
              </div>
              <div className="bg-background/30 p-5">
                <span className="font-mono-plex mb-2 block text-[10px] uppercase tracking-[0.2em] text-primary">
                  Interpretation
                </span>
                <p className="font-serif-display text-[16px] italic leading-relaxed text-foreground">
                  {p.interpretation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Decision, Reconstruction } from "@/data/mock";

const statusTone: Record<string, string> = {
  FINAL: "border-status-strong/50 text-status-strong",
  PARTIAL: "border-status-moderate/50 text-status-moderate",
  DEFERRAL: "border-foreground-muted/40 text-foreground-muted",
  CONSTRAINT: "border-status-weak/50 text-status-weak",
};

function DecisionCard({ d, artifactsById }: { d: Decision; artifactsById: Record<string, { source: string; title: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="surface-card rounded-lg transition-colors hover:border-border-strong">
      <div className="p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`font-mono-plex rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${statusTone[d.status]}`}>
            {d.status}
          </span>
          <span className="font-mono-plex rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-foreground-dim">
            {d.type}
          </span>
          <span className="ml-auto font-mono-plex flex items-baseline gap-1.5 text-[11px] uppercase tracking-[0.12em] text-foreground-faint">
            Conf
            <span className="text-foreground">{d.confidence}</span>
          </span>
        </div>

        <h3 className="font-serif-display mb-3 text-xl leading-snug text-foreground md:text-[22px]">
          {d.statement}
        </h3>

        <p className="text-[14px] leading-relaxed text-foreground-dim">{d.reasoning}</p>

        <button
          onClick={() => setOpen(!open)}
          className="font-mono-plex mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-muted transition-colors hover:text-primary"
        >
          {open ? "Hide reasoning" : "Show reasoning"}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div
        className={`grid overflow-hidden transition-all duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="hairline-top grid gap-6 p-5 md:grid-cols-2 md:p-6">
            <section>
              <h4 className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.2em] text-status-strong">
                Directly supported
              </h4>
              <ul className="space-y-2.5">
                {d.supportedReasoning.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-foreground-dim">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-status-strong" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-md border border-dashed border-border-strong bg-background/30 p-4">
              <h4 className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
                Inferred · not directly supported
              </h4>
              <ul className="space-y-2.5">
                {d.inferredReasoning.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13px] italic leading-relaxed text-foreground-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-faint" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {d.artifactIds.length > 0 && (
            <div className="hairline-top px-5 py-4 md:px-6">
              <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground-faint">
                Source artifacts
              </p>
              <div className="flex flex-wrap gap-2">
                {d.artifactIds.map((id) => (
                  <a
                    key={id}
                    href={`#artifact-${id}`}
                    className="font-mono-plex rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {artifactsById[id]?.source}: {artifactsById[id]?.title.slice(0, 40)}…
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function DecisionsLayer({ r }: { r: Reconstruction }) {
  const artifactsById = Object.fromEntries(
    r.artifacts.map((a) => [a.id, { source: a.source, title: a.title }])
  );
  return (
    <section id="decisions" className="anim-fade-up">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Decisions made
        </h2>
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          {r.decisions.length} detected
        </span>
      </div>
      <div className="space-y-3">
        {r.decisions.map((d) => (
          <DecisionCard key={d.id} d={d} artifactsById={artifactsById} />
        ))}
      </div>
    </section>
  );
}

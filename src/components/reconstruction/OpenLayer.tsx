import type { Reconstruction } from "@/data/mock";

const tagTone: Record<string, string> = {
  Deferred: "text-status-moderate border-status-moderate/40",
  Sidestepped: "text-status-weak border-status-weak/40",
  "Never addressed": "text-status-weak border-status-weak/40",
};

export default function OpenLayer({ r }: { r: Reconstruction }) {
  return (
    <section id="open" className="anim-fade-up">
      <h2 className="font-mono-plex mb-5 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        What's still open
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Column title="Unresolved questions">
          {r.open.questions.map((q, i) => (
            <li key={i} className="space-y-2">
              <p className="text-[14px] leading-relaxed text-foreground-dim">{q.text}</p>
              {q.tag && (
                <span className={`font-mono-plex inline-block rounded border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.18em] ${tagTone[q.tag]}`}>
                  {q.tag}
                </span>
              )}
            </li>
          ))}
        </Column>

        <Column title="Rejected options">
          {r.open.rejected.map((o, i) => (
            <li key={i} className="space-y-1">
              <p className="text-[14px] leading-relaxed text-foreground-dim line-through decoration-foreground-faint/60">
                {o.text}
              </p>
              {o.rationale && (
                <p className="text-[12.5px] leading-relaxed text-foreground-muted">{o.rationale}</p>
              )}
            </li>
          ))}
        </Column>

        <Column title="Outstanding assumptions">
          {r.open.assumptions.map((a, i) => (
            <li key={i} className="text-[14px] leading-relaxed text-foreground-dim">
              {a.text}
            </li>
          ))}
        </Column>
      </div>
    </section>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card rounded-lg p-5">
      <h3 className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        {title}
      </h3>
      <ul className="space-y-4">{children}</ul>
    </div>
  );
}

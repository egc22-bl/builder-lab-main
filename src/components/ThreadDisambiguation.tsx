import { ArrowRight, Users } from "lucide-react";
import { disambiguationCandidates } from "@/data/mock";

interface Props {
  query: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}

export default function ThreadDisambiguation({ query, onPick, onCancel }: Props) {
  return (
    <div className="anim-fade-up mx-auto max-w-[1100px] px-6 py-12 md:px-10">
      <button
        onClick={onCancel}
        className="font-mono-plex mb-8 text-[10px] uppercase tracking-[0.2em] text-foreground-faint hover:text-foreground-dim"
      >
        ← Back
      </button>

      <p className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        Your query
      </p>
      <p className="font-serif-display mb-8 text-2xl text-foreground md:text-3xl">"{query}"</p>

      <p className="font-serif-display mb-10 text-lg italic text-foreground-dim">
        We found more than one decision matching your query. Which one?
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {disambiguationCandidates.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{ animationDelay: `${i * 80}ms` }}
            className="anim-fade-up surface-card group flex flex-col rounded-lg p-5 text-left transition-all hover:border-primary/50 hover:bg-surface-raised/60"
          >
            <span className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
              {c.dateRange} · {c.artifacts} artifacts
            </span>
            <h3 className="font-serif-display mb-3 text-xl leading-tight text-foreground">{c.title}</h3>
            <p className="mb-5 flex-1 text-[13.5px] leading-relaxed text-foreground-dim">{c.summary}</p>
            <div className="hairline-top flex items-center justify-between pt-4">
              <span className="flex items-center gap-1.5 text-[12px] text-foreground-muted">
                <Users className="h-3 w-3" />
                {c.people.join(" · ")}
              </span>
              <ArrowRight className="h-4 w-4 text-foreground-faint transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

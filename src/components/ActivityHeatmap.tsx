import { ChevronRight } from "lucide-react";
import { heatmapZones, platformStats } from "@/data/mock";

interface Props {
  onSelect: (query: string) => void;
}

const recencyColor = (level: 1 | 2 | 3 | 4) => {
  // Brighter = more recent. Use accent at varying opacity.
  switch (level) {
    case 4: return "hsl(var(--primary) / 1)";
    case 3: return "hsl(var(--primary) / 0.7)";
    case 2: return "hsl(var(--primary) / 0.4)";
    case 1: return "hsl(var(--primary) / 0.2)";
  }
};

export default function ActivityHeatmap({ onSelect }: Props) {
  return (
    <section className="anim-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Decision activity — last {platformStats.windowDays} days
        </h2>
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          Live
          <span className="ml-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-status-strong anim-pulse-dot" />
        </span>
      </div>

      <p className="font-serif-display mb-6 text-lg leading-relaxed text-foreground-dim md:text-xl">
        Builder Lab has processed{" "}
        <span className="text-foreground">{platformStats.activityProcessed.toLocaleString()}</span> pieces
        of activity in the last {platformStats.windowDays} days and extracted{" "}
        <span className="text-foreground">{platformStats.artifactsExtracted}</span> decision artifacts.
      </p>

      <div className="surface-card overflow-hidden rounded-lg">
        {heatmapZones.map((z, i) => (
          <button
            key={z.id}
            onClick={() => onSelect(z.query)}
            className={`group relative flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-raised/60 ${
              i !== heatmapZones.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ background: recencyColor(z.recencyLevel) }}
            />
            <span
              className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: recencyColor(z.recencyLevel) }}
            />
            <span className="flex-1 truncate text-[15px] text-foreground">{z.label}</span>
            <span className="font-mono-plex hidden w-28 text-right text-xs text-foreground-dim sm:block">
              {z.artifacts} artifacts
            </span>
            <span className="font-mono-plex hidden w-28 text-right text-xs text-foreground-muted md:block">
              {z.recent} this week
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-foreground-faint transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </section>
  );
}

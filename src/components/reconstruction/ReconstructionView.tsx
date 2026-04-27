import type { Reconstruction } from "@/data/mock";
import VerdictCard from "@/components/reconstruction/VerdictCard";
import DecisionsLayer from "@/components/reconstruction/DecisionsLayer";
import OpenLayer from "@/components/reconstruction/OpenLayer";
import EvolutionLayer from "@/components/reconstruction/EvolutionLayer";
import ArtifactsLayer from "@/components/reconstruction/ArtifactsLayer";

interface Props {
  r: Reconstruction;
  onBack: () => void;
}

const NAV = [
  { id: "verdict", label: "Verdict" },
  { id: "decisions", label: "Decisions" },
  { id: "open", label: "Open" },
  { id: "evolution", label: "Evolution" },
  { id: "artifacts", label: "Artifacts" },
];

export default function ReconstructionView({ r, onBack }: Props) {
  return (
    <div className="anim-fade-in mx-auto max-w-[1100px] px-6 pb-32 pt-10 md:px-10">
      <button
        onClick={onBack}
        className="font-mono-plex mb-8 text-[10px] uppercase tracking-[0.2em] text-foreground-faint hover:text-foreground-dim"
      >
        ← New query
      </button>

      <div className="mb-8">
        <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Query
        </p>
        <h1 className="font-serif-display text-3xl leading-tight text-foreground md:text-[40px] md:leading-[1.1]">
          "{r.query}"
        </h1>
      </div>

      {/* Section nav */}
      <nav className="surface-card mb-10 flex flex-wrap items-center gap-1 rounded-md p-1">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="font-mono-plex flex-1 rounded-sm px-3 py-2 text-center text-[10px] uppercase tracking-[0.18em] text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div id="verdict" className="space-y-12">
        <VerdictCard r={r} />
        <DecisionsLayer r={r} />
        <OpenLayer r={r} />
        <EvolutionLayer r={r} />
        <ArtifactsLayer r={r} />
      </div>
    </div>
  );
}

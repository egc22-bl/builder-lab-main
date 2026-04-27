import type { Reconstruction } from "@/data/mock";

interface Props {
  r: Reconstruction;
}

type PillTone = "strong" | "moderate" | "weak" | "info";

const toneFor = (label: string, value: string): PillTone => {
  const v = value.toLowerCase();
  if (label === "STRENGTH") {
    if (v === "strong") return "strong";
    if (v === "moderate") return "moderate";
    return "weak";
  }
  if (label === "COMPLETENESS") {
    if (v === "complete") return "strong";
    if (v === "partial") return "moderate";
    return "weak";
  }
  if (label === "ALIGNMENT") {
    if (v === "aligned") return "strong";
    if (v === "contested") return "weak";
    return "moderate";
  }
  if (label === "LEARNING") {
    if (v === "captured") return "strong";
    if (v === "partial") return "moderate";
    return "weak";
  }
  return "info";
};

const toneClasses: Record<PillTone, string> = {
  strong: "border-status-strong/40 bg-status-strong/8 text-status-strong",
  moderate: "border-status-moderate/40 bg-status-moderate/8 text-status-moderate",
  weak: "border-status-weak/40 bg-status-weak/8 text-status-weak",
  info: "border-status-info/40 bg-status-info/8 text-status-info",
};

export default function VerdictCard({ r }: Props) {
  const pills: { label: string; value: string }[] = [
    { label: "STRENGTH", value: r.meta.strength },
    { label: "COMPLETENESS", value: r.meta.completeness },
    { label: "ALIGNMENT", value: r.meta.alignment },
    { label: "LEARNING", value: r.meta.learning },
  ];

  return (
    <article className="anim-fade-up surface-card-raised relative overflow-hidden rounded-xl p-7 md:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
      />

      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.25em] text-foreground-muted">
          Verdict
        </span>
        <span className="font-mono-plex flex items-baseline gap-2 text-[11px] uppercase tracking-[0.15em] text-foreground-faint">
          Confidence
          <span className="font-mono-plex text-2xl tracking-tight text-foreground">
            {r.confidence}
          </span>
          <span className="text-foreground-faint">/100</span>
        </span>
      </header>

      {/* Pattern line */}
      <div className="mb-7">
        <p className="font-mono-plex text-[11px] uppercase tracking-[0.15em] text-foreground-muted mb-2">
          Pattern
        </p>
        <p className="font-mono-plex text-sm leading-relaxed text-primary md:text-[15px]">
          {r.pattern}
        </p>
      </div>

      {/* Conclusion */}
      <p className="font-serif-display mb-8 text-2xl leading-[1.35] text-foreground md:text-[28px] md:leading-[1.3]">
        {r.conclusion}
      </p>

      {/* The four anchor pills */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {pills.map((p) => {
          const tone = toneFor(p.label, p.value);
          return (
            <div
              key={p.label}
              className={`group relative overflow-hidden rounded-md border px-4 py-3.5 transition-all hover:scale-[1.015] ${toneClasses[tone]}`}
            >
              <span className="font-mono-plex block text-[9.5px] uppercase tracking-[0.22em] opacity-70">
                {p.label}
              </span>
              <span className="font-serif-display mt-1.5 block text-[22px] leading-tight">
                {p.value}
              </span>
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-500 group-hover:scale-x-100"
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}

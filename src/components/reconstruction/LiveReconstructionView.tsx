import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileCode2, FileDown, FileText } from "lucide-react";
import type { ParsedArtifact } from "@/lib/parseArtifacts";
import type { ParsedReconstruction, ReconDecision, ResolutionStatus } from "@/lib/parseReconstruction";
import {
  downloadReconstructionJson,
  downloadReconstructionMarkdown,
  downloadReconstructionPdf,
} from "@/lib/reconstructionExports";

interface Props {
  query: string;
  result: ParsedReconstruction;
  artifacts: ParsedArtifact[];
  onBack: () => void;
}

const NAV = [
  { id: "verdict", label: "Verdict" },
  { id: "decisions", label: "Decisions" },
  { id: "open", label: "Open" },
  { id: "evolution", label: "Evolution" },
  { id: "artifacts", label: "Artifacts" },
];

const RESOLUTION_TONE: Record<ResolutionStatus, string> = {
  resolved: "border-status-strong/50 bg-status-strong/10 text-status-strong",
  "partially resolved": "border-status-moderate/50 bg-status-moderate/10 text-status-moderate",
  sidestepped: "border-[hsl(20_85%_50%/0.5)] bg-[hsl(20_85%_50%/0.12)] text-[hsl(20_90%_68%)]",
  deferred: "border-border-strong text-foreground-dim bg-secondary",
  unresolved: "border-status-weak/50 bg-status-weak/10 text-status-weak",
  unknown: "border-border text-foreground-muted bg-surface",
};

function ResolutionPill({ status, gloss }: { status: ResolutionStatus; gloss?: string }) {
  return (
    <div className={`inline-flex flex-col rounded-md border px-2.5 py-1 ${RESOLUTION_TONE[status]}`}>
      <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em]">{status}</span>
      {gloss && <span className="mt-0.5 text-[10.5px] leading-snug">{gloss}</span>}
    </div>
  );
}

function EmptyState({ note }: { note: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface/30 px-4 py-6 text-center">
      <p className="font-mono-plex text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
        {note}
      </p>
    </div>
  );
}

function FieldRow({ label, value, dim, mono }: { label: string; value: string; dim?: boolean; mono?: boolean }) {
  if (!value || /^none($|\b)/i.test(value.trim())) {
    return (
      <div>
        <p className="font-mono-plex text-[9.5px] uppercase tracking-[0.22em] text-foreground-faint">
          {label}
        </p>
        <p className="mt-1 text-xs text-foreground-faint">none</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-mono-plex text-[9.5px] uppercase tracking-[0.22em] text-foreground-faint">
        {label}
      </p>
      <p
        className={`mt-1 whitespace-pre-wrap text-[13px] leading-relaxed ${
          dim ? "text-foreground-muted" : "text-foreground-dim"
        } ${mono ? "font-mono-plex text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function DecisionCard({ d }: { d: ReconDecision }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="surface-card overflow-hidden rounded-lg transition-colors hover:border-border-strong">
      <div className="p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono-plex rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim">
              Decision {d.index}
            </span>
            {d.when && (
              <span className="font-mono-plex text-[10.5px] uppercase tracking-[0.16em] text-foreground-faint">
                {d.when}
              </span>
            )}
          </div>
          <ResolutionPill status={d.resolution} gloss={d.resolutionGloss} />
        </div>

        <h3 className="font-serif-display mb-3 text-xl leading-snug text-foreground md:text-[22px]">
          {d.decision || "—"}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Authority" value={d.authority} />
          <FieldRow label="Extraction confidence" value={d.extractionConfidence} mono />
          <div className="md:col-span-2">
            <FieldRow label="Triggering issue" value={d.triggeringIssue} />
          </div>
          <div className="md:col-span-2">
            <FieldRow label="Decision question" value={d.decisionQuestion} />
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="font-mono-plex mt-5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-muted transition-colors hover:text-primary"
        >
          {open ? "Hide reasoning + constraints" : "Show reasoning + constraints"}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div
        className={`grid overflow-hidden transition-all duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="hairline-top grid gap-5 p-5 md:grid-cols-2 md:p-6">
            <div className="rounded-sm border border-border bg-surface/40 p-4">
              <p className="font-mono-plex mb-2 text-[9.5px] uppercase tracking-[0.22em] text-status-strong">
                Observed reasoning
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground-dim">
                {d.observedReasoning || "none in artifacts"}
              </p>
            </div>
            <div className="rounded-sm border border-dashed border-border-strong bg-background/30 p-4">
              <p className="font-mono-plex mb-2 text-[9.5px] uppercase tracking-[0.22em] text-foreground-muted">
                Inferred · not directly supported
              </p>
              <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-foreground-muted">
                {d.inferredReasoning || "none — no inference available beyond what is observed"}
              </p>
            </div>
          </div>
          <div className="hairline-top grid gap-5 p-5 md:grid-cols-2 md:p-6">
            <FieldRow label="Shaping constraints" value={d.shapingConstraints} />
            <FieldRow label="Constraints produced" value={d.constraintsProduced} />
            <FieldRow label="Outcome signals" value={d.outcomeSignals} />
            <FieldRow label="Missing operational details" value={d.missingDetails} />
          </div>
        </div>
      </div>
    </article>
  );
}

function VerdictPanel({ result }: { result: ParsedReconstruction }) {
  const cs = result.currentState;
  const conf = result.confidence;
  const pills: { label: string; value: string }[] = [
    { label: "REVERSED", value: cs.status.reversed || "—" },
    { label: "IN FORCE", value: cs.status.inForce || "—" },
    { label: "OUTCOME", value: cs.status.outcome || "—" },
    { label: "FOLLOW-UP", value: cs.status.subsequent || "—" },
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
          Reconstruction confidence
          <span className="font-mono-plex text-xl tracking-tight text-foreground">
            {conf.level || "—"}
          </span>
        </span>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div>
          <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.18em] text-foreground-muted">
            Topic
          </p>
          <p className="font-serif-display text-[18px] leading-snug text-foreground">
            {result.topic || "—"}
          </p>
        </div>
        <div>
          <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.18em] text-foreground-muted">
            Latest decision
          </p>
          <p className="font-mono-plex text-[13px] leading-relaxed text-foreground-dim">
            {cs.latestDecision || "none recorded"}
          </p>
        </div>
      </div>

      {conf.primaryDriver && (
        <div className="mb-6">
          <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.18em] text-foreground-muted">
            Confidence driver
          </p>
          <p className="font-mono-plex text-[13px] leading-relaxed text-primary/90">
            {conf.primaryDriver}
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {pills.map((p) => (
          <div
            key={p.label}
            className="rounded-md border border-border bg-surface/50 px-4 py-3 transition-all hover:border-border-strong"
          >
            <span className="font-mono-plex block text-[9.5px] uppercase tracking-[0.22em] text-foreground-faint">
              {p.label}
            </span>
            <span className="font-serif-display mt-1.5 block text-[16px] leading-tight text-foreground">
              {p.value}
            </span>
          </div>
        ))}
      </div>

      {result.narrative ? (
        <div className="hairline-top pt-6">
          <p className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
            Narrative
          </p>
          <p className="font-serif-display whitespace-pre-wrap text-[16px] leading-[1.6] text-foreground md:text-[17px]">
            {result.narrative}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function OpenPanel({ result }: { result: ParsedReconstruction }) {
  const cs = result.currentState;
  const cols: { title: string; items: string[]; emptyNote: string }[] = [
    { title: "Questions still open", items: cs.questionsOpen, emptyNote: "Not enough data — no open questions parsed." },
    { title: "Recurring questions", items: cs.recurring, emptyNote: "Not enough data — no recurring questions parsed." },
    { title: "Conflicts / authority boundary", items: [...cs.conflicts, ...cs.authorityBoundary], emptyNote: "Not enough data — no conflicts parsed." },
  ];
  return (
    <section id="open" className="anim-fade-up">
      <h2 className="font-mono-plex mb-5 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        What's still open
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.title} className="surface-card rounded-lg p-5">
            <h3 className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
              {c.title}
            </h3>
            {c.items.length === 0 ? (
              <EmptyState note={c.emptyNote} />
            ) : (
              <ul className="space-y-3">
                {c.items.map((q, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-foreground-dim">
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {(cs.outcomesDegrading.length > 0 || cs.missing.length > 0) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {cs.outcomesDegrading.length > 0 && (
            <div className="surface-card rounded-lg p-5">
              <h3 className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.22em] text-status-weak">
                Outcomes degrading / unresolved
              </h3>
              <ul className="space-y-2 text-[13px] leading-relaxed text-foreground-dim">
                {cs.outcomesDegrading.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {cs.missing.length > 0 && (
            <div className="surface-card rounded-lg p-5">
              <h3 className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
                Missing from artifact set
              </h3>
              <ul className="space-y-2 text-[13px] leading-relaxed text-foreground-dim">
                {cs.missing.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EvolutionPanel({ result }: { result: ParsedReconstruction }) {
  const items = result.decisions.map((d) => ({
    when: d.when || "unknown",
    title: d.decision || `Decision ${d.index}`,
    detail:
      d.observedReasoning?.slice(0, 220) ||
      d.triggeringIssue ||
      "no observed detail",
    resolution: d.resolution,
  }));
  const nonDec = result.nonDecisionEvents;
  return (
    <section id="evolution" className="anim-fade-up">
      <h2 className="font-mono-plex mb-5 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        Evolution
      </h2>
      {items.length === 0 && nonDec.length === 0 ? (
        <EmptyState note="Not enough data — timeline could not be constructed." />
      ) : (
        <div className="surface-card rounded-lg p-6 md:p-8">
          <ol className="relative space-y-6 pl-7">
            <span
              aria-hidden
              className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border-strong to-transparent"
            />
            {items.map((n, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                    n.resolution === "resolved"
                      ? "bg-status-strong"
                      : n.resolution === "partially resolved"
                      ? "bg-status-moderate"
                      : n.resolution === "sidestepped"
                      ? "bg-[hsl(20_85%_55%)]"
                      : n.resolution === "unresolved"
                      ? "bg-status-weak"
                      : "bg-foreground-faint"
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono-plex text-[11px] uppercase tracking-[0.15em] text-foreground-muted">
                    {n.when}
                  </span>
                  <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                    {n.resolution}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-foreground">{n.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground-dim">{n.detail}</p>
              </li>
            ))}

            {nonDec.length > 0 && (
              <li className="relative pt-4">
                <p className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
                  Non-decision events in timeline
                </p>
                <ul className="space-y-2 text-[13px] leading-relaxed text-foreground-dim">
                  {nonDec.map((e, i) => (
                    <li key={i}>{e.text}</li>
                  ))}
                </ul>
              </li>
            )}
          </ol>
        </div>
      )}
    </section>
  );
}

function ArtifactsPanel({ artifacts }: { artifacts: ParsedArtifact[] }) {
  if (artifacts.length === 0) {
    return (
      <section id="artifacts" className="anim-fade-up">
        <h2 className="font-mono-plex mb-5 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Source artifacts
        </h2>
        <EmptyState note="Not enough data — no artifacts in store." />
      </section>
    );
  }
  return (
    <section id="artifacts" className="anim-fade-up">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Source artifacts — store contents
        </h2>
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          {artifacts.length} items
        </span>
      </div>
      <div className="surface-card overflow-hidden rounded-lg">
        {artifacts.map((a, i) => (
          <div
            key={a.id}
            className={`flex items-start gap-4 px-5 py-4 ${
              i !== artifacts.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="font-mono-plex mt-0.5 inline-flex items-center rounded-sm border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim">
              {a.artifactClass}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono-plex text-[12px] text-foreground-dim">
                {a.artifactId || a.inputId} {a.sourceType ? `· ${a.sourceType}` : ""}{" "}
                {a.date ? `· ${a.date}` : ""}
              </p>
              {a.topicTags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.topicTags.map((t) => (
                    <span
                      key={t}
                      className="font-mono-plex rounded-sm border border-border bg-surface/60 px-1.5 py-0.5 text-[10px] text-foreground-dim"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {a.triggeringIssue && (
                <p className="mt-2 text-[13px] leading-relaxed text-foreground-dim">
                  {a.triggeringIssue}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LiveReconstructionView({ query, result, artifacts, onBack }: Props) {
  const handleDownloadMarkdown = () => {
    downloadReconstructionMarkdown(query, result);
    toast.success("Markdown downloaded");
  };

  const handleDownloadJson = () => {
    downloadReconstructionJson(query, result);
    toast.success("JSON downloaded");
  };

  const handleDownloadPdf = () => {
    downloadReconstructionPdf(query, result);
    toast.success("PDF downloaded");
  };

  return (
    <div className="anim-fade-in mx-auto max-w-[1100px] px-6 pb-32 pt-10 md:px-10">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            onClick={onBack}
            className="font-mono-plex mb-4 text-[10px] uppercase tracking-[0.2em] text-foreground-faint hover:text-foreground-dim"
          >
            ← New query
          </button>

          <div>
            <p className="font-mono-plex mb-2 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
              Query
            </p>
            <h1 className="font-serif-display text-3xl leading-tight text-foreground md:text-[40px] md:leading-[1.1]">
              "{query}"
            </h1>
            <p className="font-mono-plex mt-3 text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
              {result.counts.inScope || `${artifacts.length} artifacts`}{" "}
              {result.counts.byClass ? `· ${result.counts.byClass}` : ""}
            </p>
          </div>
        </div>

        <div className="surface-card w-full max-w-[360px] rounded-md p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
              Download reconstruction
            </span>
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.16em] text-primary">
              Ready
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={handleDownloadMarkdown}
              className="font-mono-plex inline-flex items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-2 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileText className="h-3 w-3" /> Markdown
            </button>
            <button
              onClick={handleDownloadJson}
              className="font-mono-plex inline-flex items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-2 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileCode2 className="h-3 w-3" /> JSON
            </button>
            <button
              onClick={handleDownloadPdf}
              className="font-mono-plex inline-flex items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-2 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileDown className="h-3 w-3" /> PDF
            </button>
          </div>
        </div>
      </div>

      <nav className="surface-card mb-6 flex flex-wrap items-center gap-1 rounded-md p-1">
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
        <VerdictPanel result={result} />

        <section id="decisions" className="anim-fade-up">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
              Decisions made
            </h2>
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
              {result.decisions.length} reconstructed
            </span>
          </div>
          {result.decisions.length === 0 ? (
            <EmptyState note="Not enough data — no decisions in the artifact set." />
          ) : (
            <div className="space-y-3">
              {result.decisions.map((d) => (
                <DecisionCard key={d.index} d={d} />
              ))}
            </div>
          )}
        </section>

        <OpenPanel result={result} />
        <EvolutionPanel result={result} />
        <ArtifactsPanel artifacts={artifacts} />
      </div>
    </div>
  );
}

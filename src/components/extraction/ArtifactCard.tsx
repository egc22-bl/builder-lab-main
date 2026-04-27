import { useState } from "react";
import { ChevronDown, Copy, FileCode2, FileDown, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import type { ParsedArtifact, ParsedDecision } from "@/lib/parseArtifacts";
import { downloadJson, downloadMarkdown, downloadPdf } from "@/lib/artifactExports";

interface Props {
  artifact: ParsedArtifact;
  onSendToWorkspace: (a: ParsedArtifact) => void;
}

const CLASS_STYLES: Record<string, string> = {
  decision: "bg-primary/15 text-primary border-primary/40",
  constraint: "bg-[hsl(36_70%_50%/0.12)] text-[hsl(36_85%_62%)] border-[hsl(36_70%_45%/0.4)]",
  outcome: "bg-[hsl(200_70%_50%/0.12)] text-[hsl(200_85%_70%)] border-[hsl(200_70%_50%/0.4)]",
  reference: "bg-secondary text-foreground-muted border-border-strong",
  noise: "bg-surface text-foreground-faint border-border",
  unknown: "bg-secondary text-foreground-muted border-border",
};

const RESOLUTION_STYLES: Record<string, string> = {
  resolved: "bg-[hsl(142_50%_45%/0.18)] text-[hsl(142_55%_65%)] border-[hsl(142_50%_40%/0.5)]",
  "partially resolved":
    "bg-[hsl(36_85%_50%/0.18)] text-[hsl(36_90%_65%)] border-[hsl(36_85%_45%/0.5)]",
  sidestepped: "bg-[hsl(20_85%_55%/0.18)] text-[hsl(20_90%_68%)] border-[hsl(20_85%_50%/0.5)]",
  deferred: "bg-secondary text-foreground-dim border-border-strong",
  unresolved: "bg-[hsl(358_72%_55%/0.18)] text-[hsl(358_80%_72%)] border-[hsl(358_72%_50%/0.5)]",
};

function ResolutionTag({ status }: { status: string }) {
  const key = status.toLowerCase().trim();
  const style = RESOLUTION_STYLES[key] ?? "bg-secondary text-foreground-muted border-border";
  return (
    <span
      className={`font-mono-plex inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${style}`}
    >
      {status}
    </span>
  );
}

function FieldBlock({ label, value, dim }: { label: string; value?: string; dim?: boolean }) {
  if (!value || value.trim() === "" || value.trim().toLowerCase() === "none") {
    return (
      <div>
        <p className="font-mono-plex text-[9px] uppercase tracking-[0.22em] text-foreground-faint">
          {label}
        </p>
        <p className="mt-1 text-xs text-foreground-faint">none</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-mono-plex text-[9px] uppercase tracking-[0.22em] text-foreground-faint">
        {label}
      </p>
      <p className={`font-mono-plex mt-1 whitespace-pre-wrap text-xs leading-relaxed ${dim ? "text-foreground-muted" : "text-foreground-dim"}`}>
        {value}
      </p>
    </div>
  );
}

function DecisionBlock({ d }: { d: ParsedDecision }) {
  const f = d.fields;
  const decisionText = f["decision"] || "";
  const resolution = f["question resolution status"] || "";

  return (
    <div className="rounded-md border border-border-strong bg-surface-raised/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
          Decision {d.index}
        </p>
        {resolution && <ResolutionTag status={resolution} />}
      </div>

      {decisionText && (
        <p className="font-serif-display mb-4 text-base leading-snug text-foreground">
          {decisionText}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldBlock label="What changed" value={f["what changed"]} />
        <FieldBlock label="Triggering issue" value={f["triggering issue"]} />
        <div className="md:col-span-2">
          <FieldBlock label="Decision question(s)" value={f["decision question(s)"] || f["decision questions"]} />
        </div>
        <div className="md:col-span-2">
          <FieldBlock label="Why" value={f["why"]} />
        </div>

        <div className="md:col-span-2 rounded-sm border border-border bg-surface/40 p-3">
          <FieldBlock
            label="Directly supported reasoning (observed)"
            value={f["directly supported reasoning (observed)"] || f["directly supported reasoning"]}
          />
        </div>
        <div className="md:col-span-2 rounded-sm border border-dashed border-border bg-background/40 p-3">
          <p className="font-mono-plex mb-1 text-[9px] uppercase tracking-[0.22em] text-foreground-faint">
            Inferred reasoning (interpretation) <span className="text-primary/70">[inferred]</span>
          </p>
          <p className="font-mono-plex whitespace-pre-wrap text-xs leading-relaxed text-foreground-muted">
            {f["inferred reasoning (interpretation)"] || f["inferred reasoning"] || "none"}
          </p>
        </div>

        <FieldBlock label="Decision type" value={f["decision type"]} />
        <FieldBlock label="Decision strength" value={f["decision strength"]} />
        <FieldBlock label="Completeness" value={f["decision completeness"]} />
        <FieldBlock label="Confidence" value={f["confidence in extraction"] || f["confidence"]} />
        <div className="md:col-span-2">
          <FieldBlock label="Authority" value={f["authority"]} />
        </div>
        <div className="md:col-span-2">
          <FieldBlock label="Constraints produced" value={f["constraints produced"]} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          {title}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="font-mono-plex whitespace-pre-wrap text-xs leading-relaxed text-foreground-dim">
        {body && body.trim() ? body : "none"}
      </p>
    </div>
  );
}

export default function ArtifactCard({ artifact, onSendToWorkspace }: Props) {
  const [open, setOpen] = useState(false);

  const classStyle = CLASS_STYLES[artifact.artifactClass] ?? CLASS_STYLES.unknown;

  const copy = async () => {
    await navigator.clipboard.writeText(artifact.rawText);
    toast.success("Artifact copied to clipboard");
  };

  const exportJson = () => {
    downloadJson(artifact);
    toast.success("JSON downloaded");
  };

  const exportMarkdown = () => {
    downloadMarkdown(artifact);
    toast.success("Markdown downloaded");
  };

  const exportPdf = () => {
    downloadPdf(artifact);
    toast.success("PDF downloaded");
  };

  return (
    <article className="anim-fade-up surface-card overflow-hidden rounded-md">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface/60"
      >
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <span className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-faint">
            Artifact
          </span>
          <span className="font-mono-plex text-xs text-foreground-dim">{artifact.inputId}</span>
          <span
            className={`font-mono-plex inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${classStyle}`}
          >
            {artifact.artifactClass}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-foreground-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Collapsed summary */}
      {!open && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          {artifact.topicTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {artifact.topicTags.map((t) => (
                <span
                  key={t}
                  className="font-mono-plex rounded-sm border border-border bg-surface/60 px-2 py-0.5 text-[10px] text-foreground-dim"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-4">
            <div>
              <p className="font-mono-plex text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Decision status
              </p>
              <p className="font-mono-plex mt-0.5 text-foreground-dim">
                {artifact.decisionStatus || "—"}
              </p>
            </div>
            <div>
              <p className="font-mono-plex text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Decisions found
              </p>
              <p className="font-mono-plex mt-0.5 text-foreground-dim">
                {artifact.decisionCount}
              </p>
            </div>
            <div>
              <p className="font-mono-plex text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Confidence
              </p>
              <p className="font-mono-plex mt-0.5 text-foreground-dim">
                {artifact.confidence || "—"}
              </p>
            </div>
            <div>
              <p className="font-mono-plex text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Date
              </p>
              <p className="font-mono-plex mt-0.5 text-foreground-dim">
                {artifact.date || "unknown"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="border-t border-border px-5 py-5">
          {/* Actions */}
          <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={copy}
              className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button
              onClick={exportMarkdown}
              className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileText className="h-3 w-3" /> Markdown
            </button>
            <button
              onClick={exportJson}
              className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileCode2 className="h-3 w-3" /> JSON
            </button>
            <button
              onClick={exportPdf}
              className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FileDown className="h-3 w-3" /> PDF
            </button>
            <button
              onClick={() => onSendToWorkspace(artifact)}
              className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/20"
            >
              <Send className="h-3 w-3" /> Send to reconstruction →
            </button>
          </div>

          <div className="space-y-5">
            {/* Source metadata block */}
            <div className="grid grid-cols-2 gap-3 rounded-sm border border-border bg-surface/40 p-3 md:grid-cols-3">
              <FieldBlock label="Artifact ID" value={artifact.artifactId} />
              <FieldBlock label="Source type" value={artifact.sourceType} />
              <FieldBlock label="Date" value={artifact.date} />
              <FieldBlock label="Participants" value={artifact.participants} />
              <FieldBlock label="Triggering issue" value={artifact.triggeringIssue} />
              <div>
                <p className="font-mono-plex text-[9px] uppercase tracking-[0.22em] text-foreground-faint">
                  Topic tags
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {artifact.topicTags.length > 0 ? (
                    artifact.topicTags.map((t) => (
                      <span
                        key={t}
                        className="font-mono-plex rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground-dim"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-foreground-faint">none</span>
                  )}
                </div>
              </div>
            </div>

            <Section title="Decision status" body={artifact.decisionStatus} />

            {artifact.decisions.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
                    Decisions
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {artifact.decisions.map((d) => (
                    <DecisionBlock key={d.index} d={d} />
                  ))}
                </div>
              </div>
            )}

            <Section title="Constraints" body={artifact.sections["Constraints"]} />
            <Section title="Outcome signals" body={artifact.sections["Outcome signals"]} />
            <Section
              title="References to prior decisions"
              body={artifact.sections["References to prior decisions"]}
            />
            <Section
              title="Rejected or unchosen options"
              body={artifact.sections["Rejected or unchosen options"]}
            />
            <Section
              title="Uncertainty and unresolved questions"
              body={artifact.sections["Uncertainty and unresolved questions"]}
            />
            <Section title="Decision dynamics" body={artifact.sections["Decision dynamics"]} />
          </div>
        </div>
      )}
    </article>
  );
}

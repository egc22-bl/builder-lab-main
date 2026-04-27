import { ExternalLink, MessageSquare, FileText, ListTodo, FolderOpen, Mail, Database } from "lucide-react";
import type { Reconstruction, Source } from "@/data/mock";

const sourceIcon: Record<Source, React.ComponentType<{ className?: string }>> = {
  Slack: MessageSquare,
  Notion: FileText,
  Jira: ListTodo,
  Drive: FolderOpen,
  Mail: Mail,
  Salesforce: Database,
};

const contributionTone: Record<string, string> = {
  "Strong signal": "text-status-strong border-status-strong/40",
  Supporting: "text-status-info border-status-info/40",
  Contradicting: "text-status-weak border-status-weak/40",
};

export default function ArtifactsLayer({ r }: { r: Reconstruction }) {
  if (r.artifacts.length === 0) return null;
  return (
    <section id="artifacts" className="anim-fade-up">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Source artifacts — the receipts
        </h2>
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          {r.artifacts.length} items
        </span>
      </div>

      <div className="surface-card overflow-hidden rounded-lg">
        {r.artifacts.map((a, i) => {
          const Icon = sourceIcon[a.source];
          return (
            <a
              key={a.id}
              id={`artifact-${a.id}`}
              href="#"
              onClick={(e) => e.preventDefault()}
              className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-raised/60 ${
                i !== r.artifacts.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="h-3.5 w-3.5 text-foreground-dim" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-muted">
                    {a.source}
                  </span>
                  <span className="text-[14px] text-foreground">{a.title}</span>
                </div>
                <p className="mt-1.5 text-[13px] italic leading-relaxed text-foreground-dim">
                  "{a.excerpt}"
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono-plex text-[11px] text-foreground-muted">{a.date}</span>
                  <span className="text-[11.5px] text-foreground-dim">
                    {a.author} <span className="text-foreground-faint">· {a.authorRole}</span>
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className={`font-mono-plex rounded border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.18em] ${contributionTone[a.contribution]}`}>
                  {a.contribution}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-foreground-faint transition-colors group-hover:text-primary" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

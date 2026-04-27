import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, FileType, ChevronDown } from "lucide-react";

export interface QueuedFile {
  id: string;
  file: File;
  kind: "image" | "document" | "text" | "unknown";
}

interface Props {
  files: QueuedFile[];
  onFilesAdded: (files: QueuedFile[]) => void;
  onRemove: (id: string) => void;
  pastedText: string;
  onPastedTextChange: (v: string) => void;
  meta: { sourceType: string; dateWindow: string; participants: string };
  onMetaChange: (m: { sourceType: string; dateWindow: string; participants: string }) => void;
  isProcessing: boolean;
  processingStep: 0 | 1 | 2 | 3;
  onRun: () => void;
}

const SOURCE_TYPES = [
  "Slack thread",
  "Email",
  "Meeting transcript",
  "Jira ticket",
  "Notion doc",
  "Screenshot",
  "Unknown",
];

function classifyFile(f: File): QueuedFile["kind"] {
  const t = f.type.toLowerCase();
  const n = f.name.toLowerCase();
  if (t.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/.test(n)) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "document";
  if (
    t.startsWith("text/") ||
    /\.(txt|md|csv|log)$/.test(n) ||
    n.endsWith(".docx")
  )
    return "text";
  return "unknown";
}

function shortLabel(k: QueuedFile["kind"], f: File): string {
  if (k === "image") return "screenshot";
  if (k === "document") return "document";
  if (k === "text") return f.name.endsWith(".docx") ? "docx" : "text";
  return "unknown";
}

function FileIcon({ kind }: { kind: QueuedFile["kind"] }) {
  if (kind === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (kind === "document") return <FileType className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export default function ExtractionPanel({
  files,
  onFilesAdded,
  onRemove,
  pastedText,
  onPastedTextChange,
  meta,
  onMetaChange,
  isProcessing,
  processingStep,
  onRun,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        kind: classifyFile(f),
      }));
      onFilesAdded(arr);
    },
    [onFilesAdded],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  };

  const canRun = !isProcessing && (files.length > 0 || pastedText.trim().length > 0);

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <p className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Extraction engine — Layer 1
        </p>
        <p className="mt-2 text-sm text-foreground-dim">
          Drop raw company activity. Get structured decision artifacts.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-md border border-dashed px-6 py-10 text-center transition-all ${
          dragOver
            ? "accent-glow border-primary/60 bg-primary/5"
            : "border-border-strong bg-surface/40 hover:border-primary/40 hover:bg-surface/60"
        }`}
      >
        <Upload className="mx-auto mb-3 h-5 w-5 text-foreground-muted group-hover:text-primary" />
        <p className="font-serif-display text-lg text-foreground">
          Drop files here or click to browse
        </p>
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          Accepts screenshots, photos, PDFs, docs,
          <br />
          plain text, meeting notes, Slack exports
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.txt,.md,.docx,.csv,.log"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((qf) => (
            <li
              key={qf.id}
              className="flex items-center gap-3 rounded-sm border border-border bg-surface/50 px-3 py-2 text-xs"
            >
              <span className="text-foreground-muted">
                <FileIcon kind={qf.kind} />
              </span>
              <span className="font-mono-plex flex-1 truncate text-foreground-dim">
                {qf.file.name}
              </span>
              <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                {shortLabel(qf.kind, qf.file)}
              </span>
              <button
                onClick={() => onRemove(qf.id)}
                className="text-foreground-faint transition-colors hover:text-destructive"
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pasted text */}
      <textarea
        value={pastedText}
        onChange={(e) => onPastedTextChange(e.target.value)}
        placeholder="Or paste raw text directly..."
        className="font-mono-plex min-h-[120px] w-full resize-y rounded-md border border-border bg-surface/40 px-3 py-2.5 text-xs leading-relaxed text-foreground placeholder:text-foreground-faint focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />

      {/* Meta (collapsible) */}
      <div className="rounded-md border border-border bg-surface/30">
        <button
          onClick={() => setMetaOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
            {metaOpen ? "−" : "+"} Add source context (optional)
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-foreground-faint transition-transform ${metaOpen ? "rotate-180" : ""}`}
          />
        </button>
        {metaOpen && (
          <div className="space-y-3 border-t border-border px-3 py-3">
            <div>
              <label className="font-mono-plex mb-1 block text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Source type
              </label>
              <select
                value={meta.sourceType}
                onChange={(e) => onMetaChange({ ...meta, sourceType: e.target.value })}
                className="font-mono-plex w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
              >
                <option value="">—</option>
                {SOURCE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono-plex mb-1 block text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Date or time window
              </label>
              <input
                value={meta.dateWindow}
                onChange={(e) => onMetaChange({ ...meta, dateWindow: e.target.value })}
                placeholder="e.g. 2024-10-14 or week of Oct 14"
                className="font-mono-plex w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-foreground-faint focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-mono-plex mb-1 block text-[9px] uppercase tracking-[0.2em] text-foreground-faint">
                Participants
              </label>
              <input
                value={meta.participants}
                onChange={(e) => onMetaChange({ ...meta, participants: e.target.value })}
                placeholder="comma-separated"
                className="font-mono-plex w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-foreground-faint focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Run button / processing */}
      {isProcessing ? (
        <div className="space-y-2 rounded-md border border-border bg-surface/60 p-4">
          {[
            "Segmenting inputs...",
            "Running extraction model...",
            "Structuring artifacts...",
          ].map((label, i) => {
            const status =
              i < processingStep ? "complete" : i === processingStep ? "running" : "pending";
            return (
              <div
                key={label}
                className="font-mono-plex flex items-center justify-between text-xs text-foreground-dim"
              >
                <span>{label}</span>
                <span className="flex items-center gap-2">
                  {status === "complete" && <span className="text-status-strong">✓ complete</span>}
                  {status === "running" && (
                    <>
                      <span className="anim-pulse-dot text-primary">●</span>
                      <span className="text-foreground-dim">running</span>
                    </>
                  )}
                  {status === "pending" && (
                    <>
                      <span className="text-foreground-faint">○</span>
                      <span className="text-foreground-faint">pending</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <button
          disabled={!canRun}
          onClick={onRun}
          className="font-mono-plex w-full rounded-md bg-primary px-4 py-3 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground transition-all hover:bg-primary-glow disabled:cursor-not-allowed disabled:bg-secondary disabled:text-foreground-faint"
        >
          Extract decision artifacts →
        </button>
      )}
    </div>
  );
}

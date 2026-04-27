import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useArtifactStore } from "@/state/artifactStore";

function formatTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relative(ms: number) {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ReconstructionStorePanel() {
  const { batches, count, remove, removeBatch, renameBatch, clear } = useArtifactStore();
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (batchId: string, currentLabel: string | undefined, fallback: string) => {
    setRenamingId(batchId);
    setRenameDraft(currentLabel || fallback);
  };

  const commitRename = (batchId: string) => {
    renameBatch(batchId, renameDraft);
    setRenamingId(null);
    toast.success(renameDraft.trim() ? "Batch renamed" : "Batch label cleared");
  };

  if (count === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-border bg-surface/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
          Reconstruction store · <span className="text-primary">{count}</span> artifact{count === 1 ? "" : "s"} across {batches.length} batch{batches.length === 1 ? "" : "es"}
        </span>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-destructive">
              Clear all?
            </span>
            <button
              onClick={() => {
                clear();
                setConfirmClear(false);
                toast.success("Reconstruction store cleared");
              }}
              className="font-mono-plex rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-destructive transition-colors hover:bg-destructive/25"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="font-mono-plex rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="divide-y divide-border">
        {batches.map((b) => {
          const isOpen = openBatch === b.batchId;
          const fallbackName = `Batch · ${formatTime(b.addedAt)}`;
          const displayName = b.batchLabel || fallbackName;
          const isRenaming = renamingId === b.batchId;
          return (
            <div key={b.batchId}>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    onClick={() => setOpenBatch(isOpen ? null : b.batchId)}
                    className="flex shrink-0 items-center"
                    title={isOpen ? "Collapse" : "Expand"}
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-foreground-muted transition-transform ${isOpen ? "rotate-180" : "-rotate-90"}`}
                    />
                  </button>

                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(b.batchId);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="font-mono-plex min-w-0 flex-1 rounded-sm border border-primary/40 bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                      placeholder={fallbackName}
                    />
                  ) : (
                    <button
                      onClick={() => setOpenBatch(isOpen ? null : b.batchId)}
                      className="font-mono-plex truncate text-left text-[11px] text-foreground-dim hover:text-foreground"
                      title={displayName}
                    >
                      {displayName}
                    </button>
                  )}

                  <span className="font-mono-plex shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground-muted">
                    {b.artifacts.length} artifact{b.artifacts.length === 1 ? "" : "s"}
                  </span>
                  <span
                    className="font-mono-plex hidden shrink-0 text-[10px] text-foreground-faint sm:inline"
                    title={formatTime(b.addedAt)}
                  >
                    {relative(b.addedAt)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isRenaming ? (
                    <>
                      <button
                        onClick={() => commitRename(b.batchId)}
                        className="font-mono-plex inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/20"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="font-mono-plex rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startRename(b.batchId, b.batchLabel, fallbackName)}
                      className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                      title="Rename batch"
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                  )}
                  <button
                  onClick={() => {
                    removeBatch(b.batchId);
                    toast.success("Batch removed from store");
                  }}
                  className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-destructive/50 hover:text-destructive"
                  title="Delete this batch"
                >
                  <Trash2 className="h-3 w-3" /> Delete batch
                </button>
                </div>
              </div>

              {isOpen && (
                <ul className="border-t border-border bg-background/40 px-3 py-2">
                  {b.artifacts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="font-mono-plex text-[10px] text-foreground-muted">
                          {a.inputId}
                        </span>
                        <span className="font-mono-plex rounded-sm border border-border bg-surface/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-foreground-dim">
                          {a.artifactClass}
                        </span>
                        <span className="font-mono-plex truncate text-[10px] text-foreground-faint">
                          {a.decisionCount} decision{a.decisionCount === 1 ? "" : "s"}
                          {a.date ? ` · ${a.date}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          remove(a.id);
                          toast.success("Artifact removed");
                        }}
                        className="rounded-sm p-1 text-foreground-faint transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Remove artifact"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

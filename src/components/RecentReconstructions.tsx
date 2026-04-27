import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileCode2,
  FileDown,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useReconstructionStore,
  type SavedReconstruction,
} from "@/state/reconstructionStore";
import {
  downloadReconstructionJson,
  downloadReconstructionMarkdown,
  downloadReconstructionPdf,
} from "@/lib/reconstructionExports";

interface Props {
  onOpen: (id: string) => void;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function Row({
  item,
  onOpen,
}: {
  item: SavedReconstruction;
  onOpen: (id: string) => void;
}) {
  const { remove, rename } = useReconstructionStore();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const fallback = item.query;
  const display = item.label || fallback;

  return (
    <div className="group flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-raised/40">
      <button
        onClick={() => onOpen(item.id)}
        className="min-w-0 flex-1 truncate text-left text-[15px] text-foreground hover:text-primary"
        title={display}
      >
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                rename(item.id, draft);
                setRenaming(false);
                toast.success(draft.trim() ? "Renamed" : "Label cleared");
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            className="font-mono-plex w-full rounded-sm border border-primary/40 bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
            placeholder={fallback}
          />
        ) : (
          display
        )}
      </button>

      <span
        className="font-mono-plex text-[10px] uppercase tracking-[0.16em] text-foreground-faint"
        title={formatTime(item.savedAt)}
      >
        {relative(item.savedAt)}
      </span>

      <span className="font-mono-plex text-[10px] uppercase tracking-[0.15em] text-foreground-dim">
        {item.result.confidence.level || "—"} conf · {item.artifactCount} src
      </span>

      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadReconstructionMarkdown(item.query, item.result);
            toast.success("Markdown downloaded");
          }}
          title="Download Markdown"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
        >
          <FileText className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadReconstructionJson(item.query, item.result);
            toast.success("JSON downloaded");
          }}
          title="Download JSON"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
        >
          <FileCode2 className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadReconstructionPdf(item.query, item.result);
            toast.success("PDF downloaded");
          }}
          title="Download PDF"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
        >
          <FileDown className="h-3 w-3" />
        </button>

        {renaming ? (
          <button
            onClick={() => {
              rename(item.id, draft);
              setRenaming(false);
              toast.success(draft.trim() ? "Renamed" : "Label cleared");
            }}
            title="Save name"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDraft(item.label || item.query);
              setRenaming(true);
            }}
            title="Rename"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            remove(item.id);
            toast.success("Reconstruction deleted");
          }}
          title="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground-dim transition-colors hover:border-destructive/50 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function RecentReconstructions({ onOpen }: Props) {
  const { items, clear } = useReconstructionStore();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <section className="anim-fade-up" style={{ animationDelay: "240ms" }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
          Saved reconstructions
        </h2>
        {items.length > 0 &&
          (confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  clear();
                  setConfirmClear(false);
                  toast.success("All reconstructions cleared");
                }}
                className="font-mono-plex rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-destructive hover:bg-destructive/25"
              >
                Confirm clear
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="font-mono-plex rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-dim hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="font-mono-plex inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-foreground-faint hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          ))}
      </div>

      <div className="surface-card overflow-hidden rounded-lg">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-mono-plex mb-1 text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
              No saved reconstructions yet
            </p>
            <p className="text-[12px] text-foreground-muted">
              Run a query above. Each completed reconstruction is auto-saved here with download
              options.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <Row key={it.id} item={it} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

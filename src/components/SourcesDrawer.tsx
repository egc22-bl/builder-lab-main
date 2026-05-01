import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileCode2, FileDown, FileText, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExtractionPanel, { type QueuedFile } from "@/components/extraction/ExtractionPanel";
import ArtifactCard from "@/components/extraction/ArtifactCard";
import { parseArtifacts } from "@/lib/parseArtifacts";
import { useArtifactStore } from "@/state/artifactStore";
import { downloadAllJson, downloadAllMarkdown, downloadAllPdf } from "@/lib/artifactExports";
import { formatSupabaseInvokeError } from "@/lib/formatSupabaseInvokeError";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SourcesDrawer({ open, onClose }: Props) {
  const store = useArtifactStore();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [meta, setMeta] = useState({ sourceType: "", dateWindow: "", participants: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [confirmClear, setConfirmClear] = useState(false);

  const sources = useMemo(
    () => [...store.artifacts].sort((a, b) => b.addedAt - a.addedAt),
    [store.artifacts],
  );

  const onRun = async () => {
    setIsProcessing(true);
    setStep(0);
    try {
      const blocks: any[] = [];
      for (const qf of files) {
        const f = qf.file;
        if (qf.kind === "image") {
          const data = await readFileAsBase64(f);
          blocks.push({ type: "image", mediaType: f.type || "image/png", data, filename: f.name });
        } else if (qf.kind === "document") {
          const data = await readFileAsBase64(f);
          blocks.push({ type: "document", mediaType: "application/pdf", data, filename: f.name });
        } else {
          try {
            const text = await readFileAsText(f);
            blocks.push({ type: "text", text, filename: f.name });
          } catch {
            /* skip */
          }
        }
      }
      if (pastedText.trim()) blocks.push({ type: "text", text: pastedText.trim() });

      setStep(1);
      const { data, error: fnError } = await supabase.functions.invoke("extract-decisions", {
        body: {
          blocks,
          metadata: {
            sourceType: meta.sourceType || undefined,
            dateWindow: meta.dateWindow || undefined,
            participants: meta.participants || undefined,
          },
        },
      });
      if (fnError) {
        const msg = await formatSupabaseInvokeError(fnError, data);
        toast.error(msg);
        return;
      }
      if (data?.error) {
        const msg = await formatSupabaseInvokeError(null, data);
        toast.error(msg);
        return;
      }
      setStep(2);

      const text: string = data?.text || "";
      const parsed = parseArtifacts(text);
      if (parsed.length === 0) {
        parsed.push({
          id: `raw-${Date.now()}`,
          rawText: text,
          inputId: "input_1",
          artifactClass: "unknown",
          topicTags: [],
          decisions: [],
          decisionCount: 0,
          sections: { "Decision dynamics": text },
        });
      }
      setStep(3);
      store.add(parsed, { batchLabel: meta.sourceType?.trim() || undefined });
      toast.success(
        `Added ${parsed.length} source${parsed.length === 1 ? "" : "s"}`,
      );
      setFiles([]);
      setPastedText("");
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.error("Extraction failed:", e);
      const msg = await formatSupabaseInvokeError(e, null);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setStep(0);
    }
  };

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <p className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
              Sources
            </p>
            <p className="font-serif-display text-xl text-foreground">
              {store.count} added
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close sources"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Existing sources */}
          {sources.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
                  In your library
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      downloadAllMarkdown(sources);
                      toast.success("Markdown downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                    title="Download all as Markdown"
                  >
                    <FileText className="h-3 w-3" /> .md
                  </button>
                  <button
                    onClick={() => {
                      downloadAllJson(sources);
                      toast.success("JSON downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                    title="Download all as JSON"
                  >
                    <FileCode2 className="h-3 w-3" /> .json
                  </button>
                  <button
                    onClick={() => {
                      downloadAllPdf(sources);
                      toast.success("PDF downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                    title="Download all as PDF"
                  >
                    <FileDown className="h-3 w-3" /> .pdf
                  </button>
                  <span className="mx-1 h-3 w-px bg-border" />
                  {confirmClear ? (
                    <>
                      <button
                        onClick={() => {
                          store.clear();
                          setConfirmClear(false);
                          toast.success("Library cleared");
                        }}
                        className="font-mono-plex rounded-sm border border-destructive/50 bg-destructive/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-destructive hover:bg-destructive/20"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="font-mono-plex rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-dim hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="font-mono-plex inline-flex items-center gap-1 rounded-sm border border-transparent px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground-faint hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {sources.map((a) => (
                  <ArtifactCard
                    key={a.id}
                    artifact={a}
                    onSendToWorkspace={() => {
                      toast("Already in your library — used by every reconstruction.");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add new */}
          <div>
            <p className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
              Add new source
            </p>
            <ExtractionPanel
              files={files}
              onFilesAdded={(added) => setFiles((prev) => [...prev, ...added])}
              onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              pastedText={pastedText}
              onPastedTextChange={setPastedText}
              meta={meta}
              onMetaChange={setMeta}
              isProcessing={isProcessing}
              processingStep={step}
              onRun={onRun}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

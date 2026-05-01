import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileCode2, FileDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExtractionPanel, { type QueuedFile } from "./ExtractionPanel";
import ArtifactCard from "./ArtifactCard";
import { parseArtifacts, type ParsedArtifact } from "@/lib/parseArtifacts";
import { downloadAllJson, downloadAllMarkdown, downloadAllPdf } from "@/lib/artifactExports";
import { formatSupabaseInvokeError } from "@/lib/formatSupabaseInvokeError";
import { useArtifactStore } from "@/state/artifactStore";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      // strip "data:...;base64,"
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

export default function ExtractionScreen() {
  const store = useArtifactStore();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [meta, setMeta] = useState({ sourceType: "", dateWindow: "", participants: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [error, setError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"append" | "replace">("append");

  // Cards are driven by the persisted store so they survive tab switches and refreshes.
  const artifacts = useMemo(
    () => [...store.artifacts].sort((a, b) => b.addedAt - a.addedAt),
    [store.artifacts],
  );

  const onRun = async () => {
    setError(null);
    setIsProcessing(true);
    setStep(0);

    try {
      // Step 1: segmenting → assemble blocks
      const blocks: any[] = [];

      for (const qf of files) {
        const f = qf.file;
        if (qf.kind === "image") {
          const data = await readFileAsBase64(f);
          blocks.push({
            type: "image",
            mediaType: f.type || "image/png",
            data,
            filename: f.name,
          });
        } else if (qf.kind === "document") {
          const data = await readFileAsBase64(f);
          blocks.push({
            type: "document",
            mediaType: "application/pdf",
            data,
            filename: f.name,
          });
        } else {
          // text or unknown — try as text
          try {
            const text = await readFileAsText(f);
            blocks.push({ type: "text", text, filename: f.name });
          } catch {
            // skip unreadable
          }
        }
      }

      if (pastedText.trim()) {
        blocks.push({ type: "text", text: pastedText.trim() });
      }

      setStep(1);

      // Step 2: call edge function
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
        setError(msg);
        return;
      }
      if (data?.error) {
        const msg = await formatSupabaseInvokeError(null, data);
        setError(msg);
        return;
      }

      setStep(2);

      // Step 3: parse
      const text: string = data?.text || "";
      const parsed = parseArtifacts(text);
      if (parsed.length === 0) {
        // Fallback: show raw text as a single unparsed artifact
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
      // Auto-flow into shared store for the reconstruction engine
      const label = meta.sourceType?.trim() || `Run ${new Date().toLocaleTimeString()}`;
      if (saveMode === "replace") {
        store.replaceLast(parsed, { batchLabel: label });
      } else {
        store.add(parsed, { batchLabel: label });
      }
      if (parsed.length > 0) {
        toast.success(
          saveMode === "replace"
            ? `Replaced last batch with ${parsed.length} artifact${parsed.length === 1 ? "" : "s"}`
            : `Saved batch · ${parsed.length} artifact${parsed.length === 1 ? "" : "s"}`,
        );
      }

      // Brief pause so the operator sees "complete"
      await new Promise((r) => setTimeout(r, 350));
    } catch (e: unknown) {
      console.error("Extraction failed:", e);
      setError(await formatSupabaseInvokeError(e, null));
    } finally {
      setIsProcessing(false);
      setStep(0);
    }
  };

  const onSendToWorkspace = (a: ParsedArtifact) => {
    const before = store.count;
    store.add(a);
    // store.count is stale here; check via artifacts list isn't perfect — use simple toast.
    toast.success(before === store.count + 0 ? "Pushed to reconstruction store" : "Pushed to reconstruction store");
  };

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-0 px-6 py-8 md:px-10 lg:grid-cols-[40%_60%] lg:gap-8">
      {/* Left */}
      <section className="lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-2">
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
      </section>

      {/* Right */}
      <section className="mt-10 lg:mt-0 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pl-4">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-mono-plex text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
            Artifact output
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
              On run:
            </span>
            <div className="inline-flex overflow-hidden rounded-sm border border-border">
              {(["append", "replace"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSaveMode(m)}
                  className={`font-mono-plex px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    saveMode === m
                      ? "bg-primary/15 text-primary"
                      : "bg-background text-foreground-dim hover:text-foreground"
                  }`}
                  title={m === "append" ? "Save as new batch" : "Replace the most recent batch"}
                >
                  {m === "append" ? "Append batch" : "Replace last"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="font-mono-plex text-xs text-destructive">{error}</p>
          </div>
        )}

        {artifacts.length === 0 && !error ? (
          <div className="rounded-md border border-dashed border-border py-20 text-center">
            <p className="font-serif-display text-lg text-foreground-muted">
              Artifacts will appear here after extraction.
            </p>
          </div>
        ) : (
          <>
            {artifacts.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface/40 px-3 py-2">
                <span className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
                  {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} · download all
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      downloadAllMarkdown(artifacts);
                      toast.success("Markdown bundle downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <FileText className="h-3 w-3" /> Markdown
                  </button>
                  <button
                    onClick={() => {
                      downloadAllJson(artifacts);
                      toast.success("JSON bundle downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <FileCode2 className="h-3 w-3" /> JSON
                  </button>
                  <button
                    onClick={() => {
                      downloadAllPdf(artifacts);
                      toast.success("PDF bundle downloaded");
                    }}
                    className="font-mono-plex inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground-dim transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <FileDown className="h-3 w-3" /> PDF
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {artifacts.map((a) => (
                <ArtifactCard key={a.id} artifact={a} onSendToWorkspace={onSendToWorkspace} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import TopBar from "@/components/TopBar";
import QueryInput from "@/components/QueryInput";
import RecentReconstructions from "@/components/RecentReconstructions";
import ReconstructionLoading from "@/components/ReconstructionLoading";
import LiveReconstructionView from "@/components/reconstruction/LiveReconstructionView";
import SourcesDrawer from "@/components/SourcesDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useArtifactStore } from "@/state/artifactStore";
import { useReconstructionStore } from "@/state/reconstructionStore";
import { parseReconstruction, type ParsedReconstruction } from "@/lib/parseReconstruction";

type Mode =
  | { kind: "home" }
  | { kind: "loading"; query: string }
  | { kind: "result"; query: string; result: ParsedReconstruction };

const Index = () => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "home" });
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useArtifactStore();
  const reconStore = useReconstructionStore();

  const goHome = () => {
    setMode({ kind: "home" });
    setQuery("");
    setError(null);
    window.scrollTo({ top: 0 });
  };

  const runReconstruction = async (q: string) => {
    setError(null);
    if (store.count === 0) {
      toast.error("Add at least one source first.");
      setSourcesOpen(true);
      return;
    }
    setMode({ kind: "loading", query: q });
    window.scrollTo({ top: 0 });

    try {
      const { data, error: fnError } = await supabase.functions.invoke("reconstruct-decisions", {
        body: { query: q, artifacts: store.artifacts.map((a) => a.rawText) },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const text: string = data?.text || "";
      if (!text.trim()) throw new Error("Empty response from reconstruction engine.");
      const result = parseReconstruction(text);
      reconStore.save(q, result, store.artifacts.length);
      setMode({ kind: "result", query: q, result });
    } catch (e: any) {
      console.error("Reconstruction failed:", e);
      const msg = e?.message || "Reconstruction failed. Please try again.";
      setError(msg);
      toast.error(msg);
      setMode({ kind: "home" });
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar onTitleClick={goHome} />

      {mode.kind === "home" && (
        <main className="mx-auto max-w-[760px] px-6 pb-24 pt-12 md:px-10 md:pt-20">
          <div className="mb-10 text-center">
            <h1 className="font-serif-display anim-fade-up mb-3 text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
              What do you want to understand?
            </h1>
            <p
              className="anim-fade-up text-base text-foreground-muted"
              style={{ animationDelay: "80ms" }}
            >
              Ask about a decision, a change, or a why.
            </p>
          </div>

          <div className="mb-4">
            <QueryInput value={query} onChange={setQuery} onSubmit={runReconstruction} />
          </div>

          <div
            className="anim-fade-up mb-16 flex items-center justify-center gap-2"
            style={{ animationDelay: "160ms" }}
          >
            <button
              onClick={() => setSourcesOpen(true)}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-2 text-[13px] text-foreground-dim transition-all hover:border-primary/40 hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                {store.count === 0 ? (
                  <>Add sources to get started</>
                ) : (
                  <>
                    <span className="text-foreground">{store.count}</span>{" "}
                    source{store.count === 1 ? "" : "s"} ready
                  </>
                )}
              </span>
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <RecentReconstructions
            onOpen={(id) => {
              const item = reconStore.get(id);
              if (!item) {
                toast.error("Reconstruction not found");
                return;
              }
              setQuery(item.query);
              setMode({ kind: "result", query: item.query, result: item.result });
              window.scrollTo({ top: 0 });
            }}
          />
        </main>
      )}

      {mode.kind === "loading" && <ReconstructionLoading query={mode.query} />}

      {mode.kind === "result" && (
        <LiveReconstructionView
          query={mode.query}
          result={mode.result}
          artifacts={store.artifacts}
          onBack={goHome}
        />
      )}

      <SourcesDrawer open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
};

export default Index;

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ParsedArtifact } from "@/lib/parseArtifacts";

export interface StoredArtifact extends ParsedArtifact {
  addedAt: number; // ms epoch
  batchId: string;
  batchLabel?: string;
}

export interface ArtifactBatch {
  batchId: string;
  batchLabel?: string;
  addedAt: number;
  artifacts: StoredArtifact[];
}

interface ArtifactStoreValue {
  artifacts: StoredArtifact[];
  batches: ArtifactBatch[];
  add: (a: ParsedArtifact | ParsedArtifact[], opts?: { batchLabel?: string }) => void;
  replaceLast: (a: ParsedArtifact | ParsedArtifact[], opts?: { batchLabel?: string }) => void;
  remove: (id: string) => void;
  removeBatch: (batchId: string) => void;
  renameBatch: (batchId: string, label: string) => void;
  clear: () => void;
  count: number;
}

// Stash the context on globalThis so HMR module duplication doesn't create
// two distinct Ctx objects (which would make consumers see "no provider").
const CTX_KEY = "__builderlab_artifact_store_ctx__";
const globalScope = globalThis as unknown as Record<string, unknown>;
const Ctx =
  (globalScope[CTX_KEY] as React.Context<ArtifactStoreValue | null> | undefined) ??
  createContext<ArtifactStoreValue | null>(null);
globalScope[CTX_KEY] = Ctx;

function makeBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = "builderlab.artifactStore.v1";

function loadInitial(): StoredArtifact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredArtifact[]) : [];
  } catch {
    return [];
  }
}

export function ArtifactStoreProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<StoredArtifact[]>(() => loadInitial());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
    } catch {
      /* quota or serialization errors are non-fatal */
    }
  }, [artifacts]);

  const add = useCallback(
    (a: ParsedArtifact | ParsedArtifact[], opts?: { batchLabel?: string }) => {
      setArtifacts((prev) => {
        const incoming = Array.isArray(a) ? a : [a];
        const existing = new Set(prev.map((x) => x.id));
        const fresh = incoming.filter((x) => !existing.has(x.id));
        if (fresh.length === 0) return prev;
        const batchId = makeBatchId();
        const addedAt = Date.now();
        const stamped: StoredArtifact[] = fresh.map((x) => ({
          ...x,
          addedAt,
          batchId,
          batchLabel: opts?.batchLabel,
        }));
        return [...stamped, ...prev];
      });
    },
    [],
  );

  const replaceLast = useCallback(
    (a: ParsedArtifact | ParsedArtifact[], opts?: { batchLabel?: string }) => {
      setArtifacts((prev) => {
        const incoming = Array.isArray(a) ? a : [a];
        // Identify the most recent batch (largest addedAt).
        const latestAddedAt = prev.reduce((max, x) => (x.addedAt > max ? x.addedAt : max), 0);
        const remaining = latestAddedAt
          ? prev.filter((x) => x.addedAt !== latestAddedAt)
          : prev;
        const existing = new Set(remaining.map((x) => x.id));
        const fresh = incoming.filter((x) => !existing.has(x.id));
        if (fresh.length === 0) return remaining;
        const batchId = makeBatchId();
        const addedAt = Date.now();
        const stamped: StoredArtifact[] = fresh.map((x) => ({
          ...x,
          addedAt,
          batchId,
          batchLabel: opts?.batchLabel,
        }));
        return [...stamped, ...remaining];
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const removeBatch = useCallback((batchId: string) => {
    setArtifacts((prev) => prev.filter((a) => a.batchId !== batchId));
  }, []);

  const renameBatch = useCallback((batchId: string, label: string) => {
    const trimmed = label.trim();
    setArtifacts((prev) =>
      prev.map((a) =>
        a.batchId === batchId ? { ...a, batchLabel: trimmed || undefined } : a,
      ),
    );
  }, []);

  const clear = useCallback(() => setArtifacts([]), []);

  const batches = useMemo<ArtifactBatch[]>(() => {
    const map = new Map<string, ArtifactBatch>();
    for (const a of artifacts) {
      const b = map.get(a.batchId);
      if (b) {
        b.artifacts.push(a);
      } else {
        map.set(a.batchId, {
          batchId: a.batchId,
          batchLabel: a.batchLabel,
          addedAt: a.addedAt,
          artifacts: [a],
        });
      }
    }
    return Array.from(map.values()).sort((x, y) => y.addedAt - x.addedAt);
  }, [artifacts]);

  const value = useMemo(
    () => ({ artifacts, batches, add, replaceLast, remove, removeBatch, renameBatch, clear, count: artifacts.length }),
    [artifacts, batches, add, replaceLast, remove, removeBatch, renameBatch, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useArtifactStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useArtifactStore must be used inside ArtifactStoreProvider");
  return v;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ParsedReconstruction } from "@/lib/parseReconstruction";

export interface SavedReconstruction {
  id: string;
  query: string;
  result: ParsedReconstruction;
  savedAt: number;
  label?: string;
  artifactCount: number;
}

interface ReconstructionStoreValue {
  items: SavedReconstruction[];
  save: (query: string, result: ParsedReconstruction, artifactCount: number) => SavedReconstruction;
  remove: (id: string) => void;
  rename: (id: string, label: string) => void;
  clear: () => void;
  get: (id: string) => SavedReconstruction | undefined;
  count: number;
}

const CTX_KEY = "__builderlab_reconstruction_store_ctx__";
const globalScope = globalThis as unknown as Record<string, unknown>;
const Ctx =
  (globalScope[CTX_KEY] as React.Context<ReconstructionStoreValue | null> | undefined) ??
  createContext<ReconstructionStoreValue | null>(null);
globalScope[CTX_KEY] = Ctx;

const STORAGE_KEY = "builderlab.reconstructionStore.v1";

function loadInitial(): SavedReconstruction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedReconstruction[]) : [];
  } catch {
    return [];
  }
}

function makeId() {
  return `recon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ReconstructionStoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedReconstruction[]>(() => loadInitial());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* non-fatal */
    }
  }, [items]);

  const save = useCallback(
    (query: string, result: ParsedReconstruction, artifactCount: number) => {
      const entry: SavedReconstruction = {
        id: makeId(),
        query,
        result,
        savedAt: Date.now(),
        artifactCount,
      };
      setItems((prev) => [entry, ...prev]);
      return entry;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const rename = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, label: trimmed || undefined } : x)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<ReconstructionStoreValue>(
    () => ({
      items,
      save,
      remove,
      rename,
      clear,
      get: (id) => items.find((x) => x.id === id),
      count: items.length,
    }),
    [items, save, remove, rename, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReconstructionStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReconstructionStore must be used inside ReconstructionStoreProvider");
  return v;
}

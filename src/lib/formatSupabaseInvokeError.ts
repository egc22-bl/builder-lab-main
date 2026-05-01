import { FunctionsHttpError } from "@supabase/supabase-js";

/** Turns Edge Function invoke failures into a short user-visible string (includes JSON body when present). */
export async function formatSupabaseInvokeError(
  error: unknown,
  data: unknown,
): Promise<string> {
  if (data && typeof data === "object" && data !== null && "error" in data) {
    const err = String((data as { error?: unknown }).error ?? "").trim();
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return `${err} — ${detail.slice(0, 400)}`;
    }
    return err || "Unknown server error";
  }
  if (error instanceof FunctionsHttpError) {
    try {
      const res = error.context as Response;
      const clone = res.clone();
      const j = (await clone.json().catch(() => null)) as { error?: string; detail?: string } | null;
      if (j?.error) {
        return j.detail ? `${j.error} — ${j.detail.slice(0, 400)}` : j.error;
      }
    } catch {
      /* fall through */
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

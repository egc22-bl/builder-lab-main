import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { label: "Identifying relevant threads", suffix: "" },
  { label: "Pulling decision artifacts", suffix: "34 artifacts matched" },
  { label: "Separating supported from inferred", suffix: "" },
  { label: "Synthesizing verdict", suffix: "" },
];

interface Props {
  query: string;
}

export default function ReconstructionLoading({ query }: Props) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    [700, 1300, 1900].forEach((t, i) => {
      timers.push(window.setTimeout(() => setStep(i + 1), t));
    });
    const ticker = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      window.clearInterval(ticker);
    };
  }, []);

  const progressValue = useMemo(() => {
    const base = 16 + step * 22;
    const tail = step === STEPS.length - 1 ? Math.min(12, Math.max(0, elapsed - 2) * 2) : 0;
    return Math.min(94, base + tail);
  }, [elapsed, step]);

  const statusCopy =
    step === STEPS.length - 1
      ? elapsed > 4
        ? "Final synthesis is taking a little longer — still generating output."
        : "Generating the final reconstruction output."
      : "Working through the artifact set.";

  return (
    <div className="anim-fade-in mx-auto max-w-[760px] px-6 py-20 md:px-10">
      <p className="font-mono-plex mb-3 text-[10px] uppercase tracking-[0.22em] text-foreground-muted">
        Reconstructing
      </p>
      <p className="font-serif-display mb-12 text-2xl leading-snug text-foreground md:text-3xl">
        "{query}"
      </p>

      <div className="surface-card rounded-lg p-6">
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono-plex text-[10px] uppercase tracking-[0.2em] text-foreground-muted">
                Engine status
              </p>
              <p className="mt-1 text-sm text-foreground-dim">{statusCopy}</p>
            </div>
            <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
              {elapsed}s elapsed
            </span>
          </div>
          <Progress value={progressValue} className="h-2 bg-secondary/70" />
        </div>

        <ul className="space-y-4">
          {STEPS.map((s, i) => {
            const state = step > i ? "done" : step === i ? "running" : "pending";
            return (
              <li key={i} className="flex items-center gap-4">
                <span className="font-mono-plex w-5 text-center text-base">
                  {state === "done" && <span className="text-status-strong">✓</span>}
                  {state === "running" && (
                    <span className="text-primary anim-pulse-dot">●</span>
                  )}
                  {state === "pending" && <span className="text-foreground-faint">○</span>}
                </span>
                <span
                  className={`flex-1 text-[14px] ${
                    state === "pending" ? "text-foreground-faint" : "text-foreground-dim"
                  } ${state === "done" ? "text-foreground" : ""}`}
                >
                  {s.label}
                  {state === "running" && <span className="text-foreground-faint">…</span>}
                </span>
                <span className="font-mono-plex hidden text-[11px] uppercase tracking-[0.15em] text-foreground-muted sm:inline">
                  {state === "done" && (s.suffix || "complete")}
                  {state === "running" && "running"}
                  {state === "pending" && "pending"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

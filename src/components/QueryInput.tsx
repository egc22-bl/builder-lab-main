import { ArrowRight } from "lucide-react";
import { useState, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
}

export default function QueryInput({ value, onChange, onSubmit }: Props) {
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="anim-fade-up">
      <div
        className={`relative flex items-end gap-3 rounded-lg border bg-surface/40 px-5 py-5 transition-all duration-300 ${
          focused
            ? "border-primary/60 accent-glow bg-surface/70"
            : "border-border hover:border-border-strong"
        }`}
      >
        <textarea
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKey}
          placeholder="Ask about a decision, a change, or a why."
          className="font-serif-display max-h-48 flex-1 resize-none bg-transparent text-2xl leading-snug text-foreground placeholder:text-foreground-faint focus:outline-none md:text-3xl"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Reconstruct"
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-foreground-muted transition-all hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          Press Enter to reconstruct
        </span>
        <span className="font-mono-plex text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          Operating across 7 sources
        </span>
      </div>
    </div>
  );
}

interface Props {
  onTitleClick: () => void;
}

export default function TopBar({ onTitleClick }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[920px] items-center justify-between px-6 py-5 md:px-10">
        <button onClick={onTitleClick} className="text-left">
          <span className="font-serif-display text-2xl tracking-tight text-foreground">
            Builder Lab
          </span>
        </button>
      </div>
    </header>
  );
}

export type AppTab = "reconstruction" | "extraction";

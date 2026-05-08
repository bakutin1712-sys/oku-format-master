export function OkULogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* BAK-AI square logo placeholder */}
      <div
        className="grid h-11 w-11 place-items-center rounded-xl text-white font-display font-extrabold text-[11px] leading-none tracking-tight"
        style={{
          background: "var(--gradient-brand)",
          boxShadow: "var(--shadow-soft)",
        }}
        aria-label="BAK-AI logo"
      >
        BAK-AI
      </div>
      <div className="leading-none">
        <div className="font-display font-extrabold text-xl tracking-tight">OkU</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          KTMU diplom · BAK-AI
        </div>
      </div>
    </div>
  );
}

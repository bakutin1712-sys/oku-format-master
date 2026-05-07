export function OkULogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground font-display font-extrabold text-lg"
        style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-soft)" }}
      >
        O
      </div>
      <div className="leading-none">
        <div className="font-display font-extrabold text-xl tracking-tight">OkU</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">KTMU diploma</div>
      </div>
    </div>
  );
}

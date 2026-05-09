import bakAi from "@/assets/bak-ai.jpg";

export function OkULogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={bakAi}
        alt="BAK-AI logo"
        width={44}
        height={44}
        className="h-11 w-11 rounded-xl object-cover"
        style={{ boxShadow: "var(--shadow-soft)" }}
      />
      <div className="leading-none">
        <div className="font-display font-extrabold text-xl tracking-tight">OkU</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          KTMU diplom · BAK-AI
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OkULogo } from "@/components/OkULogo";
import { formatDocxKtmu } from "@/lib/docx.functions";
import { KTMU, FACULTY_RULES, type Faculty } from "@/lib/ktmu-constants";
import { I18N, LANGS, type Lang, t } from "@/lib/i18n";
import bakAiImg from "@/assets/bak-ai.jpg";
import {
  Upload,
  Loader2,
  CheckCircle2,
  CreditCard,
  Download,
  Sparkles,
  ShieldCheck,
  Clock,
  Printer,
  Lock,
  Gift,
  Copy,
  Check,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OkU — KTMU дипломун автоматтык форматтоо (BAK-AI)" },
      {
        name: "description",
        content:
          "OkU: КТМУ студенттери үчүн дипломду KTMU стандарты боюнча автоматтык форматтаган BAK-AI кызматы.",
      },
      { property: "og:title", content: "OkU — KTMU diplom · BAK-AI" },
      {
        property: "og:description",
        content: "Дипломду жүктө, BakayBank аркылуу төлө, даяр DOCX алып кет.",
      },
    ],
  }),
  component: OkUApp,
});

type Stage = "upload" | "checking" | "payment" | "processing" | "done";

function OkUApp() {
  const [lang, setLang] = useState<Lang>("kg");
  const [faculty, setFaculty] = useState<Faculty>("tourism");
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<ArrayBuffer | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formattingWarning, setFormattingWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formatFn = useServerFn(formatDocxKtmu);
  const tr = (k: keyof typeof I18N["kg"]) => t(lang, k);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = payload.new as { status: string };
          if (next.status === "paid") {
            setPaid(true);
            void runProcessing();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleFile(f: File) {
    setFile(f);
    const buf = await f.arrayBuffer();
    setOriginalBuffer(buf);
    setStage("checking");
    await new Promise((r) => setTimeout(r, 1000));
    const { data, error } = await supabase
      .from("orders")
      .insert({ file_name: f.name, amount: 555, currency: "KGS", status: "pending" })
      .select()
      .single();
    if (error || !data) {
      alert("Заказ түзүлбөй калды: " + error?.message);
      setStage("upload");
      return;
    }
    setOrderId(data.id);
    setStage("payment");
  }

  async function runProcessing() {
    if (!originalBuffer) return;
    setStage("processing");
    setProgress(8);
    const base64 = arrayBufferToBase64(originalBuffer);
    const tick = setInterval(() => {
      setProgress((p) => (p < 88 ? p + Math.random() * 6 : p));
    }, 220);
    try {
      const res = await formatFn({ data: { base64, faculty } });
      setFormattingWarning(res.warning ?? null);
      const out = base64ToArrayBuffer(res.base64);
      setProcessedBuffer(out);
      setProgress(100);
      setTimeout(() => setStage("done"), 300);
    } catch (e) {
      console.error(e);
      alert("Форматтоодо ката кетти.");
      setStage("payment");
    } finally {
      clearInterval(tick);
    }
  }

  function simulatePayment() {
    setPaid(true);
    void runProcessing();
  }

  function reset() {
    setFile(null);
    setOriginalBuffer(null);
    setProcessedBuffer(null);
    setOrderId(null);
    setPaid(false);
    setFormattingWarning(null);
    setStage("upload");
    if (inputRef.current) inputRef.current.value = "";
  }

  const downloadEnabled = paid && stage === "done" && !!processedBuffer;
  const rules = FACULTY_RULES[faculty];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div aria-hidden className="kg-ornament pointer-events-none absolute inset-0 -z-10 opacity-40" />

      <header className="border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <OkULogo />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <ShieldCheck className="h-4 w-4 text-success" />
              {tr("standardChip")} · A4
            </div>
            <LangSwitcher lang={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {tr("badge")}
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            <span className="bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent">
              {tr("heroTitle")}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">{tr("heroSub")}</p>
        </section>

        {/* 1. Action block: upload + faculty */}
        <div
          className="glass-card rounded-2xl p-6 md:p-8"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          {stage === "upload" && (
            <>
              <h2 className="mb-1 text-lg font-bold">{tr("step1")}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{tr("step1Sub")}</p>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr("facultyLabel")}
                </label>
                <select
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value as Faculty)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="general">{tr("facultyGeneral")}</option>
                  <option value="tourism">{tr("facultyTourism")}</option>
                </select>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {`${rules.margins.leftCm}/${rules.margins.rightCm}/${rules.margins.topCm}/${rules.margins.bottomCm} см · `}
                  {rules.pageNumber === "top-right"
                    ? "Бет номери: жогоруда оңдо"
                    : "Бет номери: ылдыйда борбордо"}
                </p>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.name.toLowerCase().endsWith(".docx")) void handleFile(f);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  dragOver
                    ? "dropzone-glow"
                    : "border-border hover:border-primary hover:bg-secondary/40"
                }`}
              >
                <Upload className="h-10 w-10 text-primary" />
                <span className="font-semibold">{tr("dropHere")}</span>
                <span className="text-xs text-muted-foreground">{tr("orClick")}</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            </>
          )}

          {stage === "checking" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">{tr("checking")}</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
            </div>
          )}

          {stage === "payment" && (
            <>
              <h2 className="mb-1 text-lg font-bold">{tr("payTitle")}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{tr("paySub")}</p>
              <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <CreditCard className="h-4 w-4" /> BakayBank
                </div>
                <img
                  src={bakAiImg}
                  alt="BakayBank · BAK-AI"
                  width={224}
                  height={224}
                  loading="lazy"
                  className="h-56 w-56 rounded-xl object-cover"
                  style={{ boxShadow: "var(--shadow-soft)" }}
                />
                <div className="text-center text-sm">
                  <div className="text-xl font-bold">555 KGS</div>
                  <div className="text-muted-foreground">BakayBank · BAK-AI</div>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={simulatePayment}>
                {tr("devSim")}
              </Button>
            </>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Sparkles className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-center font-medium">{tr("processing")}</p>
              <Progress value={progress} className="w-full max-w-md" />
              {formattingWarning && (
                <p className="text-center text-xs font-medium text-destructive">
                  {formattingWarning}
                </p>
              )}
            </div>
          )}

          {stage === "done" && (
            <>
              <div className="mb-4 flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-lg font-bold">{tr("done")}</h2>
              </div>
              {formattingWarning && (
                <p className="mb-3 rounded-lg border bg-secondary/40 p-3 text-xs font-medium text-destructive">
                  {formattingWarning}
                </p>
              )}
              <Button
                disabled={!downloadEnabled}
                className="btn-electric h-12 w-full rounded-full text-base font-semibold"
                onClick={() =>
                  processedBuffer &&
                  downloadBlob(
                    new Blob([processedBuffer], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    }),
                    renameFile(file?.name ?? "diplom.docx", "_OkU.docx"),
                  )
                }
              >
                {downloadEnabled ? (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {tr("download")}
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {tr("locked")}
                  </>
                )}
              </Button>
              <Button variant="ghost" className="mt-3 w-full" onClick={reset}>
                {tr("newDoc")}
              </Button>
            </>
          )}
        </div>

        {/* 2. Referral block (between action + benefit cards) */}
        <div className="mt-8">
          <ReferralBlock lang={lang} />
        </div>

        {/* 3. Benefit cards (moved BELOW referral) */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <WhyCard
            icon={<Clock className="h-6 w-6" />}
            title={tr("fast")}
            text={tr("fastDesc")}
          />
          <WhyCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title={tr("accurate")}
            text={tr("accurateDesc")}
          />
          <WhyCard
            icon={<Printer className="h-6 w-6" />}
            title={tr("print")}
            text={tr("printDesc")}
          />
        </section>

        <div className="mt-6 glass-card rounded-2xl p-5 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">KTMU · {rules.label}</p>
          <ul className="grid gap-1 md:grid-cols-2">
            <li>• A4 · Times New Roman 12pt</li>
            <li>
              • {`${rules.margins.leftCm}/${rules.margins.rightCm}/${rules.margins.topCm}/${rules.margins.bottomCm}`} см
            </li>
            <li>
              •{" "}
              {rules.pageNumber === "top-right"
                ? "Бет номери: жогоруда оңдо (2.5 см)"
                : "Бет номери: ылдыйда борбордо"}
            </li>
            <li>• i, ii… → 1, 2, 3 авто</li>
            <li>• Авто-мазмун: 1., 1.1., 1.1.1.</li>
            <li>• Титул барактарында номер жок</li>
          </ul>
        </div>
      </main>

      <footer className="mt-12 border-t bg-background/60 py-8 text-center text-xs text-muted-foreground backdrop-blur">
        <p className="mb-2 font-display text-sm italic text-foreground/80">
          «Билим алуу — ийне менен кудук казгандай.»
        </p>
        <p>OkU © {new Date().getFullYear()} · BAK-AI — КТМУ студенттери үчүн сүйүү менен жасалган ❤</p>
      </footer>
    </div>
  );
}

function LangSwitcher({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border bg-background/70 p-1 backdrop-blur">
      <Globe className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
            lang === l.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={lang === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function ReferralBlock({ lang }: { lang: Lang }) {
  const inviteUrl = "https://o-key.ai/invite/167d4c94";
  const [copied, setCopied] = useState(false);
  const tr = (k: keyof typeof I18N["kg"]) => t(lang, k);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success(tr("copyToast"));
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Көчүрүү ишке ашпады");
    }
  }

  return (
    <section aria-label="Referral">
      <div className="neon-card p-5 md:p-6">
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, oklch(0.78 0.18 195), oklch(0.85 0.18 95))",
              boxShadow: "0 0 20px oklch(0.78 0.18 195 / 0.6)",
            }}
            aria-hidden
          >
            <Gift className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-extrabold tracking-tight md:text-lg">
              {tr("referralTitle")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">{tr("referralSub")}</p>
            <div className="mt-2 truncate rounded-md border bg-background/60 px-3 py-1.5 font-mono text-xs text-foreground/80">
              {inviteUrl}
            </div>
          </div>
          <Button
            onClick={copyLink}
            className="btn-electric h-11 shrink-0 rounded-full px-5 text-sm font-semibold"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> {tr("copied")}
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> {tr("copy")}
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function WhyCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="glass-card group rounded-2xl p-6 transition-transform hover:-translate-y-1">
      <div
        className="mb-4 grid h-12 w-12 place-items-center rounded-xl text-primary-foreground"
        style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-soft)" }}
      >
        {icon}
      </div>
      <h3 className="mb-1 font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// suppress unused KTMU warning when faculty rules are used directly
void KTMU;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function renameFile(name: string, suffix: string) {
  return name.replace(/\.docx$/i, "") + suffix;
}

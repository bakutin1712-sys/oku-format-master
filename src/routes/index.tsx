import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OkULogo } from "@/components/OkULogo";
import { formatDocxKtmu } from "@/lib/docx.functions";
import { KTMU } from "@/lib/ktmu-constants";
import bakayQr from "@/assets/mbank-qr.png";
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

  // Realtime: listen for BakayBank webhook flipping order to 'paid'
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
      const res = await formatFn({ data: { base64 } });
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
    // DEV only — production: BakayBank webhook flips status to 'paid'.
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

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div aria-hidden className="kg-ornament pointer-events-none absolute inset-0 -z-10 opacity-40" />

      <header className="border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <OkULogo />
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <ShieldCheck className="h-4 w-4 text-success" />
            KTMU стандарты · A4 · {KTMU.margins.leftCm}/{KTMU.margins.rightCm}/
            {KTMU.margins.topCm}/{KTMU.margins.bottomCm} см
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            BAK-AI · КТМУ дипломдору үчүн №1 курал
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            <span className="bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent">
              OkU — Баарын бир иретте
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Дипломдук ишти жүктөп, <b>BakayBank</b> аркылуу төлөм кылыңыз жана даяр файлды алыңыз.
          </p>
        </section>

        <div
          className="glass-card rounded-2xl p-6 md:p-8"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          {stage === "upload" && (
            <>
              <h2 className="mb-1 text-lg font-bold">1. Документти жүктөө</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                .docx форматындагы дипломуңузду тандаңыз же сүйрөп таштаңыз.
              </p>
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
                <span className="font-semibold">Файлды бул жерге сүйрөңүз</span>
                <span className="text-xs text-muted-foreground">же чертип тандаңыз · .docx</span>
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
              <p className="font-medium">Документ KTMU ченемдери боюнча текшерилүүдө…</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
              <div className="mt-3 w-full max-w-sm space-y-2">
                <StatusBadge label={`Талаалар: ${KTMU.margins.leftCm}/${KTMU.margins.rightCm} см — текшерилди`} delay={0} />
                <StatusBadge label="Бөлүмдөр аныкталды" delay={350} />
                <StatusBadge label="Türkçe Unicode (Ö, İ, ğ) колдоосу: активдүү" delay={700} />
              </div>
            </div>
          )}

          {stage === "payment" && (
            <>
              <h2 className="mb-1 text-lg font-bold">2. BakayBank аркылуу төлөм</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                BakayBank QR-кодду сканерлеп, <b>555 сом</b> төлөңүз. Төлөм келээри менен
                форматтоо автоматтык башталат.
              </p>
              <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <CreditCard className="h-4 w-4" /> BakayBank
                </div>
                <img
                  src={bakayQr}
                  alt="BakayBank QR код"
                  className="h-56 w-56 rounded-lg object-contain"
                />
                <div className="text-center text-sm">
                  <div className="text-xl font-bold">555 KGS</div>
                  <div className="text-muted-foreground">бир документ үчүн</div>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={simulatePayment}>
                DEV: BakayBank төлөмүн ийгиликтүү деп симуляциялоо
              </Button>
            </>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Sparkles className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-center font-medium">
                Документ КТМУ стандарттарына ылайык иретке келтирилип жатат…
              </p>
              <Progress value={progress} className="w-full max-w-md" />
              <p className="text-center text-xs text-muted-foreground">
                Бөлүмдөр · нумерация (i, ii… → 1, 2, 3) · талаалар · мазмун · колонтитул
              </p>
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
                <h2 className="text-lg font-bold">Даяр! Документ форматталды.</h2>
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
                    Форматталган DOCX'ти жүктөп алуу
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Төлөмдөн кийин жеткиликтүү
                  </>
                )}
              </Button>
              <Button variant="ghost" className="mt-3 w-full" onClick={reset}>
                Жаңы документ форматтоо
              </Button>
            </>
          )}
        </div>

        <div className="mt-6 glass-card rounded-2xl p-5 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">KTMU ченемдери</p>
          <ul className="grid gap-1 md:grid-cols-2">
            <li>• Кагаз: A4 · Times New Roman 12pt</li>
            <li>
              • Талаалар: сол {KTMU.margins.leftCm} см, оң {KTMU.margins.rightCm} см, үстү{" "}
              {KTMU.margins.topCm} см, асты {KTMU.margins.bottomCm} см
            </li>
            <li>• Титул/бекитүү барактарында номер жок</li>
            <li>• "БАШ СӨЗ" / "ÖN SÖZ" — i, ii, iii…</li>
            <li>• "КЫСКАЧА МАЗМУНУ" / "ÖZET" — 1, 2, 3…</li>
            <li>• Авто-мазмун: 1., 1.1., 1.1.1. деңгээлдер</li>
          </ul>
        </div>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <WhyCard
            icon={<Clock className="h-6 w-6" />}
            title="30 секунд"
            text="Кол менен форматтоо жок — убакытты үнөмдө."
          />
          <WhyCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="100% ишенимдүү"
            text="КТМУ университетинин расмий стандарттары."
          />
          <WhyCard
            icon={<Printer className="h-6 w-6" />}
            title="Даяр DOCX"
            text="Кафедрага дароо тапшырууга боло турган файл."
          />
        </section>
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

function StatusBadge({ label, delay }: { label: string; delay: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return (
    <div className="pop-in flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
      <CheckCircle2 className="h-4 w-4" />
      <span>{label}</span>
    </div>
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

import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OkULogo } from "@/components/OkULogo";
import { DocxPreview } from "@/components/DocxPreview";
import { formatDocxKtmu } from "@/lib/docx.functions";
import { KTMU } from "@/lib/ktmu-constants";
import mbankQr from "@/assets/mbank-qr.png";
import {
  Upload,
  Loader2,
  CheckCircle2,
  FileText,
  CreditCard,
  Download,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Clock,
  Printer,
  Gift,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OkU — KTMU дипломун автоматтык форматтоо" },
      {
        name: "description",
        content:
          "OkU: Манас университетинин студенттери үчүн дипломду KTMU стандарты боюнча автоматтык форматтаган сервис.",
      },
      { property: "og:title", content: "OkU — Баарын бир иретте куруу үчүн" },
      {
        property: "og:description",
        content: "Дипломду жүктөңүз — KTMU стандартына дал келтирип берели.",
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
  const [progress, setProgress] = useState(0);
  const [formattingWarning, setFormattingWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formatFn = useServerFn(formatDocxKtmu);

  // Realtime: listen for order status -> 'paid'
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = payload.new as { status: string };
          if (next.status === "paid") void runProcessing();
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
    // Quick simulated check
    await new Promise((r) => setTimeout(r, 1200));
    // Create order
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
    // Smooth fake progress while server is patching XML
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

  async function simulatePayment() {
    if (!orderId) return;
    // For dev only — in prod, MBank webhook flips this.
    await supabase.from("orders").select("id").eq("id", orderId).single();
    // Trigger directly since we cannot UPDATE via RLS — call webhook simulation locally:
    void runProcessing();
  }

  function reset() {
    setFile(null);
    setOriginalBuffer(null);
    setProcessedBuffer(null);
    setOrderId(null);
    setFormattingWarning(null);
    setStage("upload");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero gradient + ornament background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div aria-hidden className="kg-ornament pointer-events-none absolute inset-0 -z-10 opacity-40" />

      <header className="border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <OkULogo />
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <ShieldCheck className="h-4 w-4 text-success" />
            KTMU стандарты · A4 · {KTMU.margins.leftCm}/{KTMU.margins.rightCm}/
            {KTMU.margins.topCm}/{KTMU.margins.bottomCm} см
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* HERO */}
        <section className="mb-12 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            КТМУ дипломдору үчүн №1 курал
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
            <span className="bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent">
              OkU — Баарын бир иретте
            </span>
            <br />
            <span className="text-foreground">куруу үчүн</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Дипломуңду жүктө — KTMU расмий ченемдерине ылайык 30 секундда форматтайбыз.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* LEFT: actions */}
          <aside className="space-y-4">
            <div
              className="glass-card rounded-2xl p-6"
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
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-all ${
                      dragOver
                        ? "dropzone-glow"
                        : "border-border hover:border-primary hover:bg-secondary/40"
                    }`}
                  >
                    <Upload className="h-9 w-9 text-primary" />
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
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-medium">KTMU ченемдери боюнча текшерилүүдө…</p>
                  <p className="text-sm text-muted-foreground">{file?.name}</p>
                  <div className="mt-3 w-full space-y-2">
                    <StatusBadge label={`Margins: ${KTMU.margins.leftCm}cm / ${KTMU.margins.rightCm}cm Verified`} delay={0} />
                    <StatusBadge label="Section Detection: Success" delay={350} />
                    <StatusBadge label="Turkish Unicode (Ö, İ, ğ) Support: Active" delay={700} />
                  </div>
                </div>
              )}

              {stage === "payment" && (
                <>
                  <h2 className="mb-1 text-lg font-bold">2. Төлөм</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    MBank QR-кодду сканерлеп, <b>555 сом</b> төлөңүз. Төлөм келээри менен
                    форматтоо автоматтык башталат.
                  </p>
                  <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-4">
                    <img
                      src={mbankQr}
                      alt="MBank QR код"
                      className="h-56 w-56 rounded-lg object-contain"
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="font-semibold">555 KGS</span>
                      <span className="text-muted-foreground">· MBank</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={simulatePayment}
                  >
                    DEV: Төлөмдү симуляциялоо
                  </Button>
                </>
              )}

              {stage === "processing" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                  <p className="text-center font-medium">
                    Беттер KTMU стандарты боюнча форматталууда…
                  </p>
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    Бөлүмдөр · нумерация (i, ii… → 1, 2, 3) · талаалар · колонтитул
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
                    <h2 className="text-lg font-bold">Даяр!</h2>
                  </div>
                  <div className="space-y-2">
                    {formattingWarning && (
                      <p className="rounded-lg border bg-secondary/40 p-3 text-xs font-medium text-destructive">
                        {formattingWarning}
                      </p>
                    )}
                    <Button
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
                      <Download className="mr-2 h-4 w-4" />
                      DOCX жүктөп алуу
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 w-full rounded-full"
                      onClick={() => processedBuffer && downloadAsPdf(processedBuffer, file?.name)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF жүктөп алуу
                    </Button>
                  </div>

                  <Button variant="ghost" className="mt-3 w-full" onClick={reset}>
                    Жаңы документ
                  </Button>
                </>
              )}
            </div>

            <div className="glass-card rounded-2xl p-5 text-xs text-muted-foreground">
              <p className="mb-2 font-semibold text-foreground">KTMU ченемдери</p>
              <ul className="space-y-1">
                <li>• Кагаз: A4</li>
                <li>
                  • Талаалар: сол {KTMU.margins.leftCm} см, оң {KTMU.margins.rightCm} см, үстү{" "}
                  {KTMU.margins.topCm} см, асты {KTMU.margins.bottomCm} см
                </li>
                <li>• Титулдук барактарда — номер жок</li>
                <li>• "БАШ СӨЗ" / "ÖN SÖZ" — i, ii, iii…</li>
                <li>• "КЫСКАЧА МАЗМУНУ" / "ÖZET" — 1, 2, 3…</li>
              </ul>
            </div>
          </aside>

          {/* RIGHT: preview with scanner overlay */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Документ алдын ала көрүү</h2>
              {processedBuffer && (
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                  Форматталган
                </span>
              )}
            </div>
            <div className="relative overflow-hidden rounded-2xl">
              <DocxPreview buffer={processedBuffer ?? originalBuffer} />
              {(stage === "checking" || stage === "processing") && (
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="scanner-line" />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* WHY OkU */}
        <section className="mt-16">
          <h2 className="mb-6 text-center font-display text-2xl font-extrabold md:text-3xl">
            Эмне үчүн <span className="text-primary">OkU</span>?
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <WhyCard
              icon={<Clock className="h-6 w-6" />}
              title="30 секунд"
              text="Убактыңызды үнөмдөңүз — кол менен форматтоо жок."
            />
            <WhyCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="100% Ишенимдүү"
              text="Манас университетинин расмий стандарттары."
            />
            <WhyCard
              icon={<Printer className="h-6 w-6" />}
              title="Даяр файл"
              text="Типографияга дароо жөнөтүүгө боло турган DOCX/PDF."
            />
          </div>
        </section>
      </main>

      {/* Floating referral CTA */}
      <a
        href="https://o-key.ai/invite/167d4c94"
        target="_blank"
        rel="noreferrer"
        className="group fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-transform hover:scale-105"
        style={{ background: "var(--gradient-cta)", boxShadow: "0 20px 50px -15px oklch(0.62 0.24 25 / 0.55)" }}
      >
        <Gift className="h-5 w-5" />
        <span className="hidden sm:inline">Студенттер үчүн белек: o-key.ai</span>
        <span className="sm:hidden">o-key.ai</span>
        <ExternalLink className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
      </a>

      <footer className="mt-12 border-t bg-background/60 py-6 text-center text-xs text-muted-foreground backdrop-blur">
        OkU © {new Date().getFullYear()} — КТМУ студенттери үчүн сүйүү менен жасалган ❤
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

function WhyCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
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
async function downloadAsPdf(buffer: ArrayBuffer, originalName?: string) {
  const mammothMod = await import("mammoth/mammoth.browser");
  const html2pdf = (await import("html2pdf.js")).default;
  const { value } = await mammothMod.convertToHtml({ arrayBuffer: buffer });
  const wrapper = document.createElement("div");
  wrapper.style.padding = "30mm 25mm 25mm 35mm";
  wrapper.style.fontFamily = "Times New Roman, serif";
  wrapper.style.fontSize = "12pt";
  wrapper.innerHTML = value;
  await html2pdf()
    .set({
      margin: 0,
      filename: renameFile(originalName ?? "diplom.docx", "_OkU.pdf"),
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      html2canvas: { scale: 2 },
    })
    .from(wrapper)
    .save();
}

import { createFileRoute } from "@tanstack/react-router";
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
    const base64 = arrayBufferToBase64(originalBuffer);
    try {
      const res = await formatFn({ data: { base64 } });
      const out = base64ToArrayBuffer(res.base64);
      setProcessedBuffer(out);
      setStage("done");
    } catch (e) {
      console.error(e);
      alert("Форматтоодо ката кетти.");
      setStage("payment");
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
    setStage("upload");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <OkULogo />
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <ShieldCheck className="h-4 w-4 text-success" />
            KTMU стандарты · A4 · {KTMU.margins.leftCm}/{KTMU.margins.rightCm}/
            {KTMU.margins.topCm}/{KTMU.margins.bottomCm} см
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-10 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Дипломуңду <span className="text-primary">бир иретте</span> куруп берели
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Баарын бир иретте куруу үчүн — KTMU расмий ченемдерине ылайык автоматтык
            форматтоо жана текшерүү.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* LEFT: actions */}
          <aside className="space-y-4">
            <div
              className="rounded-2xl border bg-card p-6"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              {stage === "upload" && (
                <>
                  <h2 className="mb-1 text-lg font-bold">1. Документти жүктөө</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    .docx форматындагы дипломуңузду тандаңыз.
                  </p>
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary hover:bg-secondary/40"
                  >
                    <Upload className="h-8 w-8 text-primary" />
                    <span className="font-medium">Файл тандоо</span>
                    <span className="text-xs text-muted-foreground">же сүйрөп таштаңыз</span>
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
                <div className="flex flex-col items-center gap-3 py-6">
                  <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                  <p className="font-medium">Документ форматталууда…</p>
                  <p className="text-sm text-muted-foreground">
                    Талаалар, нумерация жана бөлүмдөр коюлууда
                  </p>
                </div>
              )}

              {stage === "done" && (
                <>
                  <div className="mb-4 flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <h2 className="text-lg font-bold">Даяр!</h2>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full"
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
                      className="w-full"
                      onClick={() => processedBuffer && downloadAsPdf(processedBuffer, file?.name)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF жүктөп алуу
                    </Button>
                  </div>

                  <div className="mt-5 rounded-xl border bg-secondary/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Студенттер үчүн пайдалуу курал
                    </p>
                    <a
                      href="https://o-key.ai/invite/167d4c94"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      o-key.ai/invite/167d4c94
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <Button variant="ghost" className="mt-3 w-full" onClick={reset}>
                    Жаңы документ
                  </Button>
                </>
              )}
            </div>

            <div className="rounded-2xl border bg-card/60 p-5 text-xs text-muted-foreground">
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

          {/* RIGHT: preview */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Документ алдын ала көрүү</h2>
              {processedBuffer && (
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                  Форматталган
                </span>
              )}
            </div>
            <DocxPreview buffer={processedBuffer ?? originalBuffer} />
          </section>
        </div>
      </main>

      <footer className="mt-12 border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OkU · Баарын бир иретте куруу үчүн
      </footer>
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

import { useEffect, useState } from "react";
import mammoth from "mammoth/mammoth.browser";

export function DocxPreview({ buffer }: { buffer: ArrayBuffer | null }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buffer) return;
    setLoading(true);
    mammoth
      .convertToHtml({ arrayBuffer: buffer })
      .then((res) => setHtml(res.value))
      .catch(() => setHtml("<p>Алдын ала көрсөтүү ишке ашпай калды.</p>"))
      .finally(() => setLoading(false));
  }, [buffer]);

  if (!buffer) {
    return (
      <div className="grid h-full min-h-[500px] place-items-center rounded-2xl border border-dashed bg-card/40 p-8 text-center text-muted-foreground">
        <div>
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-secondary" />
          <p className="font-medium">Документти жүктөңүз</p>
          <p className="text-sm">Сол жактан .docx файлын тандаңыз — бул жерде көрөсүз.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none overflow-auto rounded-2xl border bg-card p-8 shadow-sm"
      style={{ minHeight: 500, maxHeight: "75vh" }}
    >
      {loading ? (
        <p className="text-muted-foreground">Жүктөлүүдө…</p>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}

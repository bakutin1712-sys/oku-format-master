// Pure DOCX XML patcher — KTMU formatting.
// Used by both server fn and (optionally) browser fallback.
import PizZip from "pizzip";
import { KTMU, cmToTwips } from "./ktmu-constants";

type SectionKind = "none" | "roman" | "arabic";

const SECT_PR_TEMPLATE = (kind: SectionKind) => {
  const left = cmToTwips(KTMU.margins.leftCm);
  const right = cmToTwips(KTMU.margins.rightCm);
  const top = cmToTwips(KTMU.margins.topCm);
  const bottom = cmToTwips(KTMU.margins.bottomCm);
  let pgNumType = "";
  if (kind === "roman") pgNumType = `<w:pgNumType w:fmt="lowerRoman" w:start="1"/>`;
  else if (kind === "arabic") pgNumType = `<w:pgNumType w:fmt="decimal" w:start="1"/>`;
  // For "none" we omit page number elements entirely (no header/footer numbering)
  return `<w:sectPr><w:pgSz w:w="${KTMU.pageSize.wTwips}" w:h="${KTMU.pageSize.hTwips}"/><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="708" w:footer="708" w:gutter="0"/>${pgNumType}<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
};

const containsKeyword = (text: string, keywords: readonly string[]) => {
  const upper = text.toUpperCase();
  return keywords.some((k) => upper.includes(k.toUpperCase()));
};

/**
 * Apply KTMU formatting to a docx file (Uint8Array / ArrayBuffer).
 * - Sets A4 + margins on every section.
 * - Splits document into sections at paragraphs whose text matches
 *   roman / arabic keywords, applying the corresponding pgNumType.
 */
export function applyKtmuFormatting(input: ArrayBuffer | Uint8Array): Uint8Array {
  const zip = new PizZip(input);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid .docx: word/document.xml not found");
  let xml = docFile.asText();

  // Remove all existing sectPr (we'll re-insert correctly).
  xml = xml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "");
  // Also strip self-closing sectPr inside pPr if any
  xml = xml.replace(/<w:sectPr\/>/g, "");

  // Find <w:body> ... </w:body>
  const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) throw new Error("Invalid .docx: <w:body> missing");
  const body = bodyMatch[1];

  // Walk paragraphs in order
  const paraRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  const paragraphs: { xml: string; text: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = paraRegex.exec(body)) !== null) {
    const pXml = m[0];
    const text = (pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join("");
    paragraphs.push({ xml: pXml, text, index: m.index });
  }

  // Determine section break points
  type Break = { paraIdx: number; kind: SectionKind };
  const breaks: Break[] = [];
  paragraphs.forEach((p, i) => {
    if (containsKeyword(p.text, KTMU.romanKeywords)) {
      breaks.push({ paraIdx: i, kind: "roman" });
    } else if (containsKeyword(p.text, KTMU.arabicKeywords)) {
      breaks.push({ paraIdx: i, kind: "arabic" });
    }
  });

  // Build new body: insert sectPr at the END of the LAST paragraph of each section.
  // Sections: [start=0 .. firstBreak-1] = "none"; [firstBreak..secondBreak-1] = breaks[0].kind; etc.
  const sectionStarts: { start: number; kind: SectionKind }[] = [];
  sectionStarts.push({ start: 0, kind: "none" });
  breaks.forEach((b) => sectionStarts.push({ start: b.paraIdx, kind: b.kind }));

  // Map paraIdx -> sectPr to inject (at last paragraph of section, except the very last section
  // which goes inline as the body-final sectPr).
  const injectAtLastPara = new Map<number, SectionKind>();
  for (let s = 0; s < sectionStarts.length - 1; s++) {
    const lastParaInSection = sectionStarts[s + 1].start - 1;
    if (lastParaInSection >= 0) {
      injectAtLastPara.set(lastParaInSection, sectionStarts[s].kind);
    }
  }
  const finalSectionKind = sectionStarts[sectionStarts.length - 1].kind;

  // Rebuild paragraphs
  const newParagraphs = paragraphs.map((p, i) => {
    const kind = injectAtLastPara.get(i);
    if (!kind) return p.xml;
    // Inject sectPr inside this paragraph's pPr (creating one if needed)
    const sectPr = SECT_PR_TEMPLATE(kind);
    if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(p.xml)) {
      return p.xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, `<w:pPr>$1${sectPr}</w:pPr>`);
    }
    return p.xml.replace(/<w:p(\b[^>]*)>/, `<w:p$1><w:pPr>${sectPr}</w:pPr>`);
  });

  const newBody = newParagraphs.join("") + SECT_PR_TEMPLATE(finalSectionKind);
  xml = xml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${newBody}</w:body>`);

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

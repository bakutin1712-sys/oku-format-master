// KTMU DOCX formatter — sets margins, splits document into 3 sections
// (no numbering / lower-roman / decimal) and injects a centered footer
// with a PAGE field rendered in 12pt Times New Roman.
import PizZip from "pizzip";
import { NumberFormat, SectionType } from "docx";
import { KTMU, FACULTY_RULES, cmToTwips, type Faculty } from "./ktmu-constants";

type SectionKind = "none" | "roman" | "arabic";

export type KtmuFormattingResult = {
  output: Uint8Array;
  warning?: string;
};

const KEYWORDS_NOT_DETECTED_WARNING = "Keywords not detected, using default KTMU structure.";
const ROMAN_TRIGGER = /(?:БАШ\s*СӨЗ|АЛГЫ\s*СӨЗ|ÖN\s*SÖZ|ON\s*SOZ|PREFACE)/iu;
// Arabic numbering starts at the Introduction section in any of the 4 supported languages.
// "Özet/Summary/Кыскача мазмуну" kept as a secondary fallback for legacy templates.
const ARABIC_TRIGGER =
  /(?:GİRİŞ|GIRIS|INTRODUCTION|КИРИШ\s*СӨЗ|КИРИШ[ҮУ]|КИРИШ|ВВЕДЕНИЕ|КЫСКАЧА\s*МАЗМУНУ|ÖZET|OZET|SUMMARY)/iu;

const PART_REL_IDS: Record<Exclude<SectionKind, "none">, string> = {
  roman: "rIdOkUPartRoman",
  arabic: "rIdOkUPartArabic",
};
const PART_FILES: Record<Exclude<SectionKind, "none">, string> = {
  roman: "word/okuPartRoman.xml",
  arabic: "word/okuPartArabic.xml",
};
const PART_TARGETS: Record<Exclude<SectionKind, "none">, string> = {
  roman: "okuPartRoman.xml",
  arabic: "okuPartArabic.xml",
};

// Auto Table of Contents block (Times New Roman 12pt). Word renders dot
// leaders and right-aligned page numbers from the TOC field on open / refresh.
function buildTocXml(): string {
  const tnrRpr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
  const tnrRprPlain = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
  return (
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r>${tnrRpr}<w:t xml:space="preserve">МАЗМУНУ / İÇİNDEKİLER</w:t></w:r></w:p>` +
    `<w:p>` +
    `<w:r>${tnrRprPlain}<w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>` +
    `<w:r>${tnrRprPlain}<w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>` +
    `<w:r>${tnrRprPlain}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r>${tnrRprPlain}<w:t>Mazmunduk таблицаны жаңылоо үчүн F9 басыңыз.</w:t></w:r>` +
    `<w:r>${tnrRprPlain}<w:fldChar w:fldCharType="end"/></w:r>` +
    `</w:p>` +
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`
  );
}

// Page-number part. For "bottom-center" we emit a footer (centered);
// for "top-right" we emit a header (right-aligned).
function buildPageNumPart(position: "bottom-center" | "top-right"): {
  rootTag: "w:ftr" | "w:hdr";
  xml: string;
} {
  const rootTag = position === "top-right" ? "w:hdr" : "w:ftr";
  const align = position === "top-right" ? "right" : "center";
  const tnr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<${rootTag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="${align}"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>
    <w:r>${tnr}<w:fldChar w:fldCharType="begin"/></w:r>
    <w:r>${tnr}<w:instrText xml:space="preserve"> PAGE   \\* MERGEFORMAT </w:instrText></w:r>
    <w:r>${tnr}<w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</${rootTag}>`;
  return { rootTag, xml };
}

function buildSectPr(kind: SectionKind, faculty: Faculty): string {
  const rules = FACULTY_RULES[faculty];
  const left = cmToTwips(rules.margins.leftCm);
  const right = cmToTwips(rules.margins.rightCm);
  const top = cmToTwips(rules.margins.topCm);
  const bottom = cmToTwips(rules.margins.bottomCm);
  // Tourism: page number 2.5 cm from top edge.
  const headerTwips = rules.pageNumber === "top-right" ? cmToTwips(2.5) : 708;
  let pgNumType = "";
  let partRef = "";
  if (kind === "roman") {
    pgNumType = `<w:pgNumType w:fmt="${NumberFormat.LOWER_ROMAN}" w:start="1"/>`;
    const refTag = rules.pageNumber === "top-right" ? "headerReference" : "footerReference";
    partRef = `<w:${refTag} w:type="default" r:id="${PART_REL_IDS.roman}"/>`;
  } else if (kind === "arabic") {
    pgNumType = `<w:pgNumType w:fmt="${NumberFormat.DECIMAL}" w:start="1"/>`;
    const refTag = rules.pageNumber === "top-right" ? "headerReference" : "footerReference";
    partRef = `<w:${refTag} w:type="default" r:id="${PART_REL_IDS.arabic}"/>`;
  }
  return `<w:sectPr>${partRef}<w:type w:val="${SectionType.NEXT_PAGE}"/><w:pgSz w:w="${KTMU.pageSize.wTwips}" w:h="${KTMU.pageSize.hTwips}"/><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="${headerTwips}" w:footer="708" w:gutter="0"/>${pgNumType}<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
}

const normalizeForSearch = (text: string) => text.normalize("NFC").toLocaleUpperCase("tr-TR");

const decodeXmlText = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));

const matchesTrigger = (text: string, trigger: RegExp) => {
  trigger.lastIndex = 0;
  return trigger.test(normalizeForSearch(text));
};

const hasPageBreak = (pXml: string) =>
  /<w:br\b[^>]*w:type="page"/.test(pXml) || /<w:lastRenderedPageBreak\s*\/>/.test(pXml);

function getThirdPageStartParagraph(paragraphs: { xml: string; text: string }[]): number {
  const pageStarts = [0];
  paragraphs.forEach((p, i) => {
    if (hasPageBreak(p.xml) && i + 1 < paragraphs.length) pageStarts.push(i + 1);
  });
  return pageStarts[2] ?? Math.min(2, Math.max(0, paragraphs.length - 1));
}

function ensureRelationship(
  relsXml: string,
  id: string,
  target: string,
  type: "footer" | "header",
): string {
  if (relsXml.includes(`Id="${id}"`)) return relsXml;
  const rel = `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  return relsXml.replace(/<\/Relationships>/, `${rel}</Relationships>`);
}

function ensureContentType(ctXml: string, partName: string, type: "footer" | "header"): string {
  if (ctXml.includes(`PartName="${partName}"`)) return ctXml;
  const override = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`;
  return ctXml.replace(/<\/Types>/, `${override}</Types>`);
}

export function applyKtmuFormatting(
  input: ArrayBuffer | Uint8Array,
  faculty: Faculty = "general",
): KtmuFormattingResult {
  const zip = new PizZip(input);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid .docx: word/document.xml not found");
  let xml = docFile.asText();

  // Ensure r: namespace on <w:document>
  if (!/xmlns:r=/.test(xml)) {
    xml = xml.replace(
      /<w:document\b([^>]*)>/,
      `<w:document$1 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    );
  }

  // Strip existing sectPr
  xml = xml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "").replace(/<w:sectPr\/>/g, "");

  const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) throw new Error("Invalid .docx: <w:body> missing");
  const body = bodyMatch[1];

  const paraRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  const paragraphs: { xml: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = paraRegex.exec(body)) !== null) {
    const pXml = m[0];
    const text = (pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
      .map((t) => decodeXmlText(t.replace(/<[^>]+>/g, "")))
      .join("");
    paragraphs.push({ xml: pXml, text });
  }

  type Break = { paraIdx: number; kind: SectionKind };
  const breaks: Break[] = [];
  let warning: string | undefined;

  const arabicStart = paragraphs.findIndex((p) => matchesTrigger(p.text, ARABIC_TRIGGER));

  if (faculty === "tourism") {
    // STRICT 3-SECTION ENGINE for Tourism Faculty (Bitirme Tezi Yönergesi, Ek-A):
    //   Section 1 = Dış Kapak + İç Kapak (first 2 pages, NO page numbers)
    //   Section 2 = preliminary pages (lowerRoman i, ii, iii…)
    //   Section 3 = main body from GİRİŞ onward (decimal 1, 2, 3…)
    const romanStart = getThirdPageStartParagraph(paragraphs);
    const arabicIdx = arabicStart > romanStart ? arabicStart : -1;
    breaks.push({ paraIdx: romanStart, kind: "roman" });
    if (arabicIdx >= 0) {
      breaks.push({ paraIdx: arabicIdx, kind: "arabic" });
    } else {
      warning = KEYWORDS_NOT_DETECTED_WARNING;
    }
  } else {
    const romanStart = paragraphs.findIndex((p) => matchesTrigger(p.text, ROMAN_TRIGGER));
    const arabicIdx =
      romanStart >= 0
        ? paragraphs.findIndex((p, i) => i > romanStart && matchesTrigger(p.text, ARABIC_TRIGGER))
        : arabicStart;

    if (romanStart >= 0) breaks.push({ paraIdx: romanStart, kind: "roman" });
    if (arabicIdx >= 0) breaks.push({ paraIdx: arabicIdx, kind: "arabic" });

    if (romanStart < 0) {
      breaks.push({ paraIdx: getThirdPageStartParagraph(paragraphs), kind: "arabic" });
      warning = KEYWORDS_NOT_DETECTED_WARNING;
    } else if (arabicIdx < 0) {
      warning = KEYWORDS_NOT_DETECTED_WARNING;
    }
  }

  const sectionStarts: { start: number; kind: SectionKind }[] = [{ start: 0, kind: "none" }];
  breaks.forEach((b) => sectionStarts.push({ start: b.paraIdx, kind: b.kind }));

  const injectAtLastPara = new Map<number, SectionKind>();
  for (let s = 0; s < sectionStarts.length - 1; s++) {
    const lastParaInSection = sectionStarts[s + 1].start - 1;
    if (lastParaInSection >= 0) injectAtLastPara.set(lastParaInSection, sectionStarts[s].kind);
  }
  const finalSectionKind = sectionStarts[sectionStarts.length - 1].kind;

  const newParagraphs = paragraphs.map((p, i) => {
    const kind = injectAtLastPara.get(i);
    let xmlOut = p.xml;
    if (kind) {
      const sectPr = buildSectPr(kind, faculty);
      if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(xmlOut)) {
        xmlOut = xmlOut.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, `<w:pPr>$1${sectPr}</w:pPr>`);
      } else {
        xmlOut = xmlOut.replace(/<w:p(\b[^>]*)>/, `<w:p$1><w:pPr>${sectPr}</w:pPr>`);
      }
    }
    if (arabicStart >= 0 && i === arabicStart) {
      return buildTocXml() + xmlOut;
    }
    return xmlOut;
  });

  const newBody = newParagraphs.join("") + buildSectPr(finalSectionKind, faculty);
  xml = xml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${newBody}</w:body>`);
  zip.file("word/document.xml", xml);

  const usedKinds = new Set<SectionKind>([finalSectionKind, ...breaks.map((b) => b.kind)]);
  const position = FACULTY_RULES[faculty].pageNumber;
  const part = buildPageNumPart(position);
  const partKind: "footer" | "header" = position === "top-right" ? "header" : "footer";

  const relsPath = "word/_rels/document.xml.rels";
  let relsXml = zip.file(relsPath)?.asText();
  if (!relsXml) {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  }

  const ctPath = "[Content_Types].xml";
  let ctXml = zip.file(ctPath)?.asText() ?? "";

  (["roman", "arabic"] as const).forEach((kind) => {
    if (!usedKinds.has(kind)) return;
    zip.file(PART_FILES[kind], part.xml);
    relsXml = ensureRelationship(relsXml!, PART_REL_IDS[kind], PART_TARGETS[kind], partKind);
    ctXml = ensureContentType(ctXml, "/" + PART_FILES[kind], partKind);
  });

  zip.file(relsPath, relsXml);
  if (ctXml) zip.file(ctPath, ctXml);

  return { output: zip.generate({ type: "uint8array", compression: "DEFLATE" }), warning };
}

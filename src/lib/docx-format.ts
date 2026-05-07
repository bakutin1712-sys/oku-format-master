// KTMU DOCX formatter — sets margins, splits document into 3 sections
// (no numbering / lower-roman / decimal) and injects a centered footer
// with a PAGE field rendered in 12pt Times New Roman.
import PizZip from "pizzip";
import { KTMU, cmToTwips } from "./ktmu-constants";

type SectionKind = "none" | "roman" | "arabic";

const FOOTER_REL_IDS: Record<Exclude<SectionKind, "none">, string> = {
  roman: "rIdOkUFooterRoman",
  arabic: "rIdOkUFooterArabic",
};
const FOOTER_FILES: Record<Exclude<SectionKind, "none">, string> = {
  roman: "word/footerOkURoman.xml",
  arabic: "word/footerOkUArabic.xml",
};
const FOOTER_TARGETS: Record<Exclude<SectionKind, "none">, string> = {
  roman: "footerOkURoman.xml",
  arabic: "footerOkUArabic.xml",
};

function buildFooterXml(): string {
  // Centered PAGE field, 12pt Times New Roman.
  // pgNumType in sectPr controls the visual format (i/ii/iii vs 1/2/3).
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
    </w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:instrText xml:space="preserve"> PAGE   \\* MERGEFORMAT </w:instrText></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;
}

const SECT_PR = (kind: SectionKind) => {
  const left = cmToTwips(KTMU.margins.leftCm);
  const right = cmToTwips(KTMU.margins.rightCm);
  const top = cmToTwips(KTMU.margins.topCm);
  const bottom = cmToTwips(KTMU.margins.bottomCm);
  let pgNumType = "";
  let footerRef = "";
  if (kind === "roman") {
    pgNumType = `<w:pgNumType w:fmt="lowerRoman" w:start="1"/>`;
    footerRef = `<w:footerReference w:type="default" r:id="${FOOTER_REL_IDS.roman}"/>`;
  } else if (kind === "arabic") {
    pgNumType = `<w:pgNumType w:fmt="decimal" w:start="1"/>`;
    footerRef = `<w:footerReference w:type="default" r:id="${FOOTER_REL_IDS.arabic}"/>`;
  }
  return `<w:sectPr>${footerRef}<w:pgSz w:w="${KTMU.pageSize.wTwips}" w:h="${KTMU.pageSize.hTwips}"/><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="708" w:footer="708" w:gutter="0"/>${pgNumType}<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
};

const containsKeyword = (text: string, keywords: readonly string[]) => {
  const upper = text.toUpperCase();
  return keywords.some((k) => upper.includes(k.toUpperCase()));
};

function ensureRelationship(relsXml: string, id: string, target: string): string {
  if (relsXml.includes(`Id="${id}"`)) return relsXml;
  const rel = `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="${target}"/>`;
  return relsXml.replace(/<\/Relationships>/, `${rel}</Relationships>`);
}

function ensureContentType(ctXml: string, partName: string): string {
  if (ctXml.includes(`PartName="${partName}"`)) return ctXml;
  const override = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
  return ctXml.replace(/<\/Types>/, `${override}</Types>`);
}

export function applyKtmuFormatting(input: ArrayBuffer | Uint8Array): Uint8Array {
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
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join("");
    paragraphs.push({ xml: pXml, text });
  }

  type Break = { paraIdx: number; kind: SectionKind };
  const breaks: Break[] = [];
  let romanFound = false;
  let arabicFound = false;
  paragraphs.forEach((p, i) => {
    if (!romanFound && containsKeyword(p.text, KTMU.romanKeywords)) {
      breaks.push({ paraIdx: i, kind: "roman" });
      romanFound = true;
    } else if (!arabicFound && containsKeyword(p.text, KTMU.arabicKeywords)) {
      breaks.push({ paraIdx: i, kind: "arabic" });
      arabicFound = true;
    }
  });

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
    if (!kind) return p.xml;
    const sectPr = SECT_PR(kind);
    if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(p.xml)) {
      return p.xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, `<w:pPr>$1${sectPr}</w:pPr>`);
    }
    return p.xml.replace(/<w:p(\b[^>]*)>/, `<w:p$1><w:pPr>${sectPr}</w:pPr>`);
  });

  const newBody = newParagraphs.join("") + SECT_PR(finalSectionKind);
  xml = xml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${newBody}</w:body>`);
  zip.file("word/document.xml", xml);

  // Add footer parts (only if used)
  const usedKinds = new Set<SectionKind>([finalSectionKind, ...breaks.map((b) => b.kind)]);
  const footerXml = buildFooterXml();

  // Update relationships
  const relsPath = "word/_rels/document.xml.rels";
  let relsXml = zip.file(relsPath)?.asText();
  if (!relsXml) {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  }

  // Update content types
  const ctPath = "[Content_Types].xml";
  let ctXml = zip.file(ctPath)?.asText() ?? "";

  (["roman", "arabic"] as const).forEach((kind) => {
    if (!usedKinds.has(kind)) return;
    zip.file(FOOTER_FILES[kind], footerXml);
    relsXml = ensureRelationship(relsXml!, FOOTER_REL_IDS[kind], FOOTER_TARGETS[kind]);
    ctXml = ensureContentType(ctXml, "/" + FOOTER_FILES[kind]);
  });

  zip.file(relsPath, relsXml);
  if (ctXml) zip.file(ctPath, ctXml);

  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

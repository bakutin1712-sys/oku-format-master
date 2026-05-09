// KTMU "OkU" расмий форматтоо ченемдери
export type Faculty = "general" | "tourism";

export const KTMU = {
  paper: "A4",
  // 1 cm = 567 twentieths of a point (twips). DOCX uses twips for margins.
  margins: {
    leftCm: 3.5,
    rightCm: 2.5,
    topCm: 3.0,
    bottomCm: 2.5,
  },
  // A4: 21 x 29.7 cm
  pageSize: { wTwips: 11906, hTwips: 16838 },
  romanKeywords: ["БАШ СӨЗ", "АЛГЫ СӨЗ", "ÖN SÖZ", "ON SOZ", "PREFACE"],
  arabicKeywords: ["КЫСКАЧА МАЗМУНУ", "ÖZET", "OZET", "SUMMARY"],
} as const;

// Per-faculty layout (margins in cm + page-number placement).
export const FACULTY_RULES: Record<
  Faculty,
  {
    label: string;
    margins: { leftCm: number; rightCm: number; topCm: number; bottomCm: number };
    pageNumber: "bottom-center" | "top-right";
  }
> = {
  general: {
    label: "Жалпы стандарт (General)",
    margins: KTMU.margins,
    pageNumber: "bottom-center",
  },
  tourism: {
    label: "Туризм факультети (Tourism)",
    margins: { leftCm: 4.0, rightCm: 2.5, topCm: 4.0, bottomCm: 2.5 },
    pageNumber: "top-right",
  },
};

export const cmToTwips = (cm: number) => Math.round(cm * 567);

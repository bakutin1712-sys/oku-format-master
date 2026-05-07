// KTMU "OkU" расмий форматтоо ченемдери
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

export const cmToTwips = (cm: number) => Math.round(cm * 567);

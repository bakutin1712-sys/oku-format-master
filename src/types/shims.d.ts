declare module "mammoth/mammoth.browser" {
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  const _default: { convertToHtml: typeof convertToHtml };
  export default _default;
}
declare module "html2pdf.js" {
  const html2pdf: () => any;
  export default html2pdf;
}

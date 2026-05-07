import { createServerFn } from "@tanstack/react-start";
import { applyKtmuFormatting } from "./docx-format";

export const formatDocxKtmu = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string }) => d)
  .handler(async ({ data }) => {
    const buf = Buffer.from(data.base64, "base64");
    const out = applyKtmuFormatting(buf);
    return { base64: Buffer.from(out).toString("base64") };
  });

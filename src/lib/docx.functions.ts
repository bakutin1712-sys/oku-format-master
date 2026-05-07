import { createServerFn } from "@tanstack/react-start";
import { applyKtmuFormatting } from "./docx-format";

export const formatDocxKtmu = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string }) => d)
  .handler(async ({ data }) => {
    const buf = Buffer.from(data.base64, "base64");
    const result = applyKtmuFormatting(buf);
    return { base64: Buffer.from(result.output).toString("base64"), warning: result.warning };
  });

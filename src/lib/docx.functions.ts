import { createServerFn } from "@tanstack/react-start";
import { applyKtmuFormatting } from "./docx-format";
import type { Faculty } from "./ktmu-constants";

export const formatDocxKtmu = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string; faculty?: Faculty }) => d)
  .handler(async ({ data }) => {
    const buf = Buffer.from(data.base64, "base64");
    const result = applyKtmuFormatting(buf, data.faculty ?? "general");
    return { base64: Buffer.from(result.output).toString("base64"), warning: result.warning };
  });

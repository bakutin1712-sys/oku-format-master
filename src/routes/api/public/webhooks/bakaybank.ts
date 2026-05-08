import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

// BakayBank payment webhook. Reuses MBANK_WEBHOOK_SECRET secret name
// (kept stable to avoid re-prompting the user for a new secret).
export const Route = createFileRoute("/api/public/webhooks/bakaybank")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MBANK_WEBHOOK_SECRET;
        if (!secret) return new Response("Server misconfigured", { status: 500 });

        const signature = request.headers.get("x-bakaybank-signature") || "";
        const body = await request.text();
        const expected = createHmac("sha256", secret).update(body).digest("hex");

        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(expected, "utf8");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { order_id?: string; status?: string; payment_ref?: string };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!payload.order_id) return new Response("Missing order_id", { status: 400 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { error } = await supabase
          .from("orders")
          .update({
            status: payload.status === "paid" ? "paid" : "failed",
            payment_ref: payload.payment_ref ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.order_id);

        if (error) return new Response(error.message, { status: 500 });
        return new Response("ok");
      },
    },
  },
});

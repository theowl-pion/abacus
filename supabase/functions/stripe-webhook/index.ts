// Supabase Edge Function: receives Stripe's `checkout.session.completed`
// webhook, verifies its signature, logs the order, and emails the buyer
// their download link via Resend. Deploy with:
//   supabase functions deploy stripe-webhook
// Required secrets (supabase secrets set ...):
//   STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, SITE_URL
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://example.com";
const TOLERANCE_SECONDS = 300;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function parseSignatureHeader(
  header: string,
): { timestamp: string; signature: string } | null {
  const parts: Record<string, string> = {};
  for (const pair of header.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) parts[key] = value;
  }
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

async function verifySignature(
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!header || !WEBHOOK_SECRET) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const { timestamp, signature } = parsed;
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (Number.isNaN(age) || age > TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const digest = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (digest.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i++) {
    mismatch |= digest.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");

  if (!(await verifySignature(rawBody, signatureHeader))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== "checkout.session.completed") {
    return new Response("Ignored", { status: 200 });
  }

  const session = event.data?.object ?? {};
  const sessionId = String(session.id ?? "");
  const wallpaperIds = String(session.metadata?.wallpaper_ids ?? "")
    .split(",")
    .map((s: string) => parseInt(s, 10))
    .filter((n: number) => !Number.isNaN(n));
  const buyerEmail: string | undefined = session.customer_details?.email;

  if (!sessionId || wallpaperIds.length === 0) {
    return new Response("Missing order data", { status: 400 });
  }

  const downloadUrl = `${SITE_URL}/order/success?ids=${wallpaperIds.join(",")}`;

  const { error: insertError } = await supabase.from("orders").insert({
    stripe_session_id: sessionId,
    wallpaper_ids: wallpaperIds,
    status: "paid",
    download_url: downloadUrl,
  });

  if (insertError && !insertError.message.toLowerCase().includes("duplicate")) {
    console.error("Failed to log order:", insertError.message);
  }

  if (buyerEmail && RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Vettos <orders@vettos.xyz>",
          to: buyerEmail,
          subject: "Your Vettos wallpaper pack is ready",
          html: `<p>Thanks for your order! Your ${wallpaperIds.length}-wallpaper pack is ready.</p><p><a href="${downloadUrl}">Download your pack</a></p>`,
        }),
      });
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
    }
  }

  return new Response("OK", { status: 200 });
});

import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";

// gpt-image-1 is a synchronous call (no job-id/poll pattern like kie.ai), but
// generation now happens inside this function's lifetime instead of being
// hidden behind client-side polling, so give it real headroom.
export const maxDuration = 60;

const MODEL = "gpt-image-1";
// Closest native portrait preset — gpt-image-1 only supports 1024x1024,
// 1024x1536, and 1536x1024. There is no native 9:16.
const SIZE = "1024x1536" as const;
const QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY as "low" | "medium" | "high" | undefined) ??
  "medium";
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

function mapOpenAiError(err: unknown): { message: string; status: number } {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return {
        message: "Rate limited by OpenAI — try again in a moment.",
        status: 429,
      };
    }
    if (err.status === 400) {
      const code = (err as { code?: string | null }).code ?? "";
      if (code === "content_policy_violation" || code === "moderation_blocked") {
        return {
          message: "Rejected by OpenAI's content policy — rewrite the prompt.",
          status: 400,
        };
      }
      return { message: `Invalid request: ${err.message}`, status: 400 };
    }
    if (err.status === 401 || err.status === 403) {
      return {
        message: "OpenAI authentication failed — check OPENAI_API_KEY.",
        status: 500,
      };
    }
    if (err.status && err.status >= 500) {
      return {
        message: "OpenAI is having issues right now — try again.",
        status: 502,
      };
    }
    return { message: err.message || "OpenAI request failed", status: 502 };
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return { message: "Timed out waiting for OpenAI.", status: 504 };
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { message: "Network error reaching OpenAI.", status: 502 };
  }
  return {
    message: err instanceof Error ? err.message : "Unknown error",
    status: 500,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // maxRetries gives us basic backoff on 429/5xx for free — no hand-rolled
  // retry loop needed.
  const client = new OpenAI({ apiKey, maxRetries: 2 });

  try {
    const result = await client.images.generate({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "No image returned by OpenAI" },
        { status: 502 },
      );
    }

    const rawBuffer = Buffer.from(b64, "base64");

    // Explicit crop step: gpt-image-1 has no native 9:16 size, so we generate
    // at 1024x1536 (2:3) and center-crop to exactly 1080x1920 (9:16). This is
    // a real, visible difference from kie.ai's native 9:16 output — content
    // near the left/right edges of the prompt can get cropped out here.
    const cropped = await sharp(rawBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 88 })
      .toBuffer();

    const imageDataUrl = `data:image/jpeg;base64,${cropped.toString("base64")}`;
    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    const { message, status } = mapOpenAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

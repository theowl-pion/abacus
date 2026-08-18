import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";

// gpt-image-2 is a synchronous call (no job-id/poll pattern like kie.ai), but
// generation now happens inside this function's lifetime instead of being
// hidden behind client-side polling, so give it real headroom.
export const maxDuration = 60;

const MODEL = "gpt-image-2";
// gpt-image-2 accepts arbitrary sizes (both edges must be multiples of 16px),
// unlike gpt-image-1's three fixed presets. 1088x1920 is the closest valid
// size to true 9:16 (1080x1920) — off by 8px on the width, vs. the ~7.8%
// per-side crop gpt-image-1 would have needed from its nearest fixed preset.
const SIZE = "1088x1920" as const;
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
  // .trim() guards against a stray trailing space/newline in .env.local —
  // that alone is enough to break Bearer auth and looks like an invalid key.
  const apiKey = process.env.OPENAI_API_KEY?.trim();
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

    // Explicit crop step: gpt-image-2 has no exact 1080-wide preset (edges
    // must be multiples of 16px), so we generate at 1088x1920 and center-crop
    // 8px total off the width to land on exactly 1080x1920. Negligible at
    // this scale, but kept explicit rather than assumed.
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

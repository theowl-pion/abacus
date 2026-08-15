import { NextResponse } from "next/server";
import sharp from "sharp";

const BASE_URL = "https://api.kie.ai/api/v1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { taskId } = await params;

  const res = await fetch(`${BASE_URL}/jobs/recordInfo?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();

  if (data.code !== 200) {
    return NextResponse.json(
      { error: data.msg ?? "status_check_failed" },
      { status: 502 },
    );
  }

  const state = String(data.data?.state ?? "unknown").toLowerCase();

  if (state === "fail" || state === "failed") {
    return NextResponse.json({
      status: "failed",
      error: data.data?.failMsg ?? "Generation failed",
    });
  }

  if (state !== "success" && state !== "done") {
    return NextResponse.json({ status: "generating" });
  }

  const resultJson = JSON.parse(data.data?.resultJson ?? "{}");
  const images: string[] = resultJson.resultUrls ?? resultJson.images ?? [];
  if (images.length === 0) {
    return NextResponse.json({ status: "failed", error: "No image returned" });
  }

  // No crop/resize needed (no fixed target spec here) — re-encode to JPEG
  // purely as a response-size safety measure, since a raw 1K PNG base64'd
  // into JSON can approach Vercel's serverless response size ceiling.
  const imageRes = await fetch(images[0]);
  const rawBuffer = Buffer.from(await imageRes.arrayBuffer());
  const jpeg = await sharp(rawBuffer).jpeg({ quality: 88 }).toBuffer();

  const imageDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  return NextResponse.json({ status: "done", imageDataUrl });
}

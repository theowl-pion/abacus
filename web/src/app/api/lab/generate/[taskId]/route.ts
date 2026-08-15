import { NextResponse } from "next/server";
import sharp from "sharp";
import { FACEBOOK_SPECS, type ImageType } from "@/lib/facebookSpecs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BASE_URL = "https://api.kie.ai/api/v1";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { taskId } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const model = searchParams.get("model");
  const prompt = searchParams.get("prompt");

  if (type !== "profile" && type !== "cover") {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (!model || !prompt) {
    return NextResponse.json({ error: "missing_model_or_prompt" }, { status: 400 });
  }

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

  // Crop precisely to Facebook's real spec — the AI model only offers fixed
  // presets (e.g. 16:9), which don't match Facebook's actual ratios.
  const spec = FACEBOOK_SPECS[type as ImageType];
  const imageRes = await fetch(images[0]);
  const rawBuffer = Buffer.from(await imageRes.arrayBuffer());

  const cropped = await sharp(rawBuffer)
    .resize(spec.width, spec.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const filename = `${type}-${slugify(model)}-${Date.now()}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("lab-images")
    .upload(filename, cropped, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { status: "failed", error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("lab-images")
    .getPublicUrl(filename);

  await supabaseAdmin.from("lab_images").insert({
    type,
    model,
    prompt,
    image_path: filename,
    width: spec.width,
    height: spec.height,
  });

  return NextResponse.json({
    status: "done",
    imageUrl: publicUrlData.publicUrl,
  });
}

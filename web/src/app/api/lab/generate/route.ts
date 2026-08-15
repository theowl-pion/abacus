import { NextResponse } from "next/server";
import { FACEBOOK_SPECS, type ImageType } from "@/lib/facebookSpecs";
import { isImageModelId } from "@/lib/imageModels";

const BASE_URL = "https://api.kie.ai/api/v1";

async function createTask(apiKey: string, model: string, prompt: string, aspectRatio: string) {
  const res = await fetch(`${BASE_URL}/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "1K",
      },
    }),
  });
  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(data.msg ?? "task_creation_failed");
  }
  return data.data.taskId as string;
}

export async function POST(request: Request) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    prompt?: unknown;
    type?: unknown;
    models?: unknown;
  };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const type =
    body.type === "profile" || body.type === "cover"
      ? (body.type as ImageType)
      : null;
  const models = Array.isArray(body.models)
    ? body.models.filter(isImageModelId)
    : [];

  if (!prompt || !type || models.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const spec = FACEBOOK_SPECS[type];

  const tasks = await Promise.all(
    models.map(async (model) => {
      try {
        const taskId = await createTask(apiKey, model, prompt, spec.aspectRatio);
        return { model, taskId, error: null as string | null };
      } catch (err) {
        return {
          model,
          taskId: null as string | null,
          error: err instanceof Error ? err.message : "task_creation_failed",
        };
      }
    }),
  );

  return NextResponse.json({ tasks });
}

import { NextResponse } from "next/server";

const BASE_URL = "https://api.kie.ai/api/v1";
const MODEL = "gpt-image-2-text-to-image";
const ASPECT_RATIO = "9:16";
const RESOLUTION = "1K";

async function createTask(apiKey: string, prompt: string) {
  const res = await fetch(`${BASE_URL}/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: {
        prompt,
        aspect_ratio: ASPECT_RATIO,
        resolution: RESOLUTION,
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

  const body = (await request.json()) as { prompts?: unknown };
  const prompts = Array.isArray(body.prompts)
    ? body.prompts
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .map((p, index) => ({ index, prompt: p }))
        .filter((p) => p.prompt.length > 0)
    : [];

  if (prompts.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const tasks = await Promise.all(
    prompts.map(async ({ index, prompt }) => {
      try {
        const taskId = await createTask(apiKey, prompt);
        return { index, taskId, error: null as string | null };
      } catch (err) {
        return {
          index,
          taskId: null as string | null,
          error: err instanceof Error ? err.message : "task_creation_failed",
        };
      }
    }),
  );

  return NextResponse.json({ tasks });
}

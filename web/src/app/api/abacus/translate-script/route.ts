import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { mapAnthropicError } from "@/lib/anthropicErrors";
import { getPageProfile, isPageProfileId } from "@/lib/pageProfiles";
import {
  TRANSLATE_SYSTEM_PROMPT,
  TRANSLATE_OUTPUT_SCHEMA,
  buildTranslateUserMessage,
  getLanguageLabel,
  isLanguageCode,
} from "@/lib/translatePrompt";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

// Deliberately stateless — no Supabase read/write. Translating a script
// never touches images/image prompts (see translatePrompt.ts), and nothing
// about a translation is persisted; it's displayed for the current session
// only, same as the base script and generated images already are.
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    title?: unknown;
    lines?: unknown;
    profileId?: unknown;
    languageCode?: unknown;
  };

  const title = typeof body.title === "string" ? body.title : "";
  const lines = Array.isArray(body.lines)
    ? body.lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    : [];
  const profileId = body.profileId;
  const languageCode = body.languageCode;

  if (!title || lines.length === 0 || !isPageProfileId(profileId) || !isLanguageCode(languageCode)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const profile = getPageProfile(profileId);
  const languageLabel = getLanguageLabel(languageCode);
  const userMessage = buildTranslateUserMessage(
    title,
    lines,
    profile.scriptSystemPrompt,
    languageLabel,
  );

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: TRANSLATE_SYSTEM_PROMPT,
      output_config: {
        format: jsonSchemaOutputFormat(TRANSLATE_OUTPUT_SCHEMA),
      },
      messages: [{ role: "user", content: userMessage }],
    });

    const translation = response.parsed_output;
    if (!translation || translation.lines.length !== lines.length) {
      return NextResponse.json(
        { error: "Anthropic returned a mismatched translation" },
        { status: 502 },
      );
    }

    return NextResponse.json({ translation });
  } catch (err) {
    const { message, status } = mapAnthropicError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

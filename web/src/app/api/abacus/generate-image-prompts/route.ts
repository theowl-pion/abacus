import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapAnthropicError } from "@/lib/anthropicErrors";
import { getPageProfile, isPageProfileId } from "@/lib/pageProfiles";
import {
  IMAGE_PROMPT_SYSTEM_PROMPT,
  IMAGE_PROMPT_OUTPUT_SCHEMA,
  deriveLineRoles,
  buildImagePromptUserMessage,
} from "@/lib/imagePromptWriterPrompt";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const AVOID_LIST_LIMIT = 30;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { lines?: unknown; profileId?: unknown };
  const lines = Array.isArray(body.lines)
    ? body.lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    : [];
  const profileId = body.profileId;

  if (lines.length === 0 || !isPageProfileId(profileId)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const profile = getPageProfile(profileId);

  const [{ data: history, error: historyError }, { data: characterHistory, error: characterHistoryError }] =
    await Promise.all([
      supabaseAdmin
        .from("abacus_scripts")
        .select("central_image")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(AVOID_LIST_LIMIT),
      supabaseAdmin
        .from("abacus_characters")
        .select("character_summary")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(AVOID_LIST_LIMIT),
    ]);

  if (historyError) {
    return NextResponse.json(
      { error: `Failed to read central-image history: ${historyError.message}` },
      { status: 502 },
    );
  }
  if (characterHistoryError) {
    return NextResponse.json(
      { error: `Failed to read character history: ${characterHistoryError.message}` },
      { status: 502 },
    );
  }

  const avoidList = Array.from(
    new Set(
      (history ?? [])
        .map((row) => (row as { central_image: string }).central_image)
        .filter((v) => v && v.trim().length > 0),
    ),
  );

  const characterAvoidList = Array.from(
    new Set(
      (characterHistory ?? [])
        .map((row) => (row as { character_summary: string }).character_summary)
        .filter((v) => v && v.trim().length > 0),
    ),
  );

  const roles = deriveLineRoles(lines, profile.roleLabels);
  const userMessage = buildImagePromptUserMessage(
    lines,
    roles,
    avoidList,
    profile.visualConfig,
    profile.label,
    characterAvoidList,
  );

  // Verification per the character-repetition fix: confirm the character
  // avoid-list is actually reaching the API on every call, not just
  // assumed to be wired up.
  console.log(`[abacus] generate-image-prompts user message (${profileId}):`, userMessage);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: IMAGE_PROMPT_SYSTEM_PROMPT,
      output_config: {
        format: jsonSchemaOutputFormat(IMAGE_PROMPT_OUTPUT_SCHEMA),
      },
      messages: [{ role: "user", content: userMessage }],
    });

    const parsed = response.parsed_output;
    if (!parsed || parsed.prompts.length !== lines.length) {
      return NextResponse.json(
        { error: "Anthropic returned a mismatched number of prompts" },
        { status: 502 },
      );
    }

    if (parsed.character_summary && parsed.character_summary.trim().length > 0) {
      const { error: insertError } = await supabaseAdmin.from("abacus_characters").insert({
        profile_id: profileId,
        character_summary: parsed.character_summary,
      });
      if (insertError) {
        console.error("Failed to save character to history:", insertError.message);
      }
    }

    return NextResponse.json({ prompts: parsed.prompts });
  } catch (err) {
    const { message, status } = mapAnthropicError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

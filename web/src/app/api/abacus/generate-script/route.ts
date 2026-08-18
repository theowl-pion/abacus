import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapAnthropicError } from "@/lib/anthropicErrors";
import { getPageProfile, isPageProfileId } from "@/lib/pageProfiles";
import {
  SCRIPT_OUTPUT_SCHEMA,
  buildScriptUserMessage,
  type ScriptHistoryEntry,
} from "@/lib/scriptSystemPrompt";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const HISTORY_LIMIT = 30;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { topicSteer?: unknown; profileId?: unknown };
  const topicSteer = typeof body.topicSteer === "string" ? body.topicSteer : "";
  const profileId = body.profileId;
  if (!isPageProfileId(profileId)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const profile = getPageProfile(profileId);

  const { data: history, error: historyError } = await supabaseAdmin
    .from("abacus_scripts")
    .select("pattern_used, topic_category, central_image, title, lines, hook_line")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    return NextResponse.json(
      { error: `Failed to read script history: ${historyError.message}` },
      { status: 502 },
    );
  }

  const userMessage = buildScriptUserMessage(
    (history ?? []) as ScriptHistoryEntry[],
    topicSteer,
  );

  // Verification per the hook/opening-line avoid-list fix: confirm both
  // running avoid-lists are actually present and non-empty in the outgoing
  // request, not just assumed to be wired up correctly.
  console.log(`[abacus] generate-script user message (${profileId}):`, userMessage);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: profile.scriptSystemPrompt,
      output_config: {
        format: jsonSchemaOutputFormat(SCRIPT_OUTPUT_SCHEMA),
      },
      messages: [{ role: "user", content: userMessage }],
    });

    const script = response.parsed_output;
    if (!script) {
      return NextResponse.json(
        { error: "No script returned by Anthropic" },
        { status: 502 },
      );
    }

    const { error: insertError } = await supabaseAdmin.from("abacus_scripts").insert({
      profile_id: profileId,
      title: script.title,
      lines: script.lines,
      word_count: script.word_count,
      estimated_duration_seconds: script.estimated_duration_seconds,
      pattern_used: script.pattern_used,
      topic_category: script.topic_category,
      central_image: script.central_image,
      hook_score: script.hook_score,
      hook_line: script.hook_line ?? script.opening_line ?? null,
    });
    if (insertError) {
      console.error("Failed to save script to history:", insertError.message);
    }

    return NextResponse.json({ script });
  } catch (err) {
    const { message, status } = mapAnthropicError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

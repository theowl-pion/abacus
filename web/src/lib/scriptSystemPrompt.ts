// Generic, profile-agnostic helpers for Abacus's script-generation call.
// The actual system prompt text is per-profile (see
// web/src/lib/profiles/*.ts) — this file only holds the shared output
// schema, the dynamic user-message builder, and a small text utility used
// downstream by the image-prompt-writer step.

export const SCRIPT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
    word_count: { type: "integer" },
    estimated_duration_seconds: { type: "integer" },
    pattern_used: { type: "string" },
    topic_category: { type: "string" },
    central_image: { type: "string" },
    hook_score: { type: "number" },
    // Heartlines-only field ("prose" | "verse") — optional so Mindset Of
    // The Wealthy's response (which never sets it) still validates against
    // this one shared schema.
    format: { type: "string" },
    thumbnail_caption: { type: "string" },
    // Each profile only ever sets ONE of these two — Mindset Of The
    // Wealthy's "hook" vs Heartlines' "opening line" — both optional here so
    // one shared schema validates both profiles' responses.
    hook_line: { type: "string" },
    opening_line: { type: "string" },
    insight: { type: "string" },
  },
  required: [
    "title",
    "lines",
    "word_count",
    "estimated_duration_seconds",
    "pattern_used",
    "topic_category",
    "central_image",
    "hook_score",
    "thumbnail_caption",
    "insight",
  ],
  additionalProperties: false,
} as const;

export type GeneratedScript = {
  title: string;
  lines: string[];
  word_count: number;
  estimated_duration_seconds: number;
  pattern_used: string;
  topic_category: string;
  central_image: string;
  hook_score: number;
  format?: string;
  thumbnail_caption: string;
  hook_line?: string;
  opening_line?: string;
  insight: string;
};

export type ScriptHistoryEntry = {
  pattern_used: string;
  topic_category: string;
  central_image: string;
  title: string;
  lines: string[];
  // Persisted from whichever of GeneratedScript's hook_line/opening_line
  // was set — one shared column, since both are the same concept (this
  // script's first/hook line) under a profile-specific name.
  hook_line?: string;
};

// The exact dynamic user-message template every profile's script-writer
// system prompt requires on every call — without this, the model has no
// memory of prior scripts and will eventually repeat a pattern, category,
// central image, or hook/opening line. Deliberately brand-agnostic wording
// ("script", not "Mindset Of The Wealthy script") so this one function
// serves every profile without forking.
export function buildScriptUserMessage(
  history: ScriptHistoryEntry[],
  topicSteer: string,
): string {
  const lastPattern = history[0]?.pattern_used;
  const centralImages = history.map((h) => h.central_image).filter(Boolean);
  const recentTopicCategories = history
    .slice(0, 2)
    .map((h) => h.topic_category)
    .filter(Boolean);

  const patternClause = lastPattern
    ? `Do not use pattern ${lastPattern} (used in the immediately previous script).`
    : "No previous script yet — any pattern is fine.";

  const imagesClause =
    centralImages.length > 0
      ? `Do not reuse these central images/metaphors, they already belong to earlier scripts: ${centralImages.join(", ")}.`
      : "No earlier scripts yet — no central images to avoid.";

  const hookLines = history.map((h) => h.hook_line).filter(Boolean) as string[];
  const hookLinesClause =
    hookLines.length > 0
      ? `Do not reuse or closely echo these hook/opening lines, they already belong to earlier scripts: ${hookLines.join(", ")}.`
      : "No earlier scripts yet — no hook/opening lines to avoid.";

  const categoriesClause =
    recentTopicCategories.length > 0
      ? `Avoid these topic categories if they were used in the last 1-2 scripts: ${recentTopicCategories.join(", ")}.`
      : "No recent topic categories to avoid yet.";

  const titlesAndHooks = history
    .filter((h) => h.title && h.lines?.length > 0)
    .map((h) => `"${h.title}" (hook: "${stripScriptTags(h.lines[0])}")`);

  const overlapClause =
    titlesAndHooks.length > 0
      ? `Recent script titles and hooks on this page — avoid close thematic or wording overlap with them: ${titlesAndHooks.join("; ")}.`
      : "No earlier scripts yet — no titles/hooks to avoid overlapping with.";

  const steerClause = `Optional topic steer: ${topicSteer.trim() || "your choice"}.`;

  return `Generate one new script. ${patternClause} ${imagesClause} ${hookLinesClause} ${categoriesClause} ${overlapClause} ${steerClause}`;
}

// Strips script-only pacing tags ([pause], [whispers], etc.) before a line
// becomes an image-generation prompt — they're meaningless as visual
// direction and would only confuse the image model. A no-op on profiles
// (like Heartlines) that never emit tags in the first place.
export function stripScriptTags(line: string): string {
  return line
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

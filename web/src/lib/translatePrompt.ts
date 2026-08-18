// Translation step for Abacus scripts. Unlike the other three system
// prompts in this pipeline, no verbatim "Translator system prompt" document
// was supplied — the user's spec was a functional description (preserve
// voice register, preserve tag placement only if present, natural
// idiomatic phrasing, same quality bar), so this system prompt is drafted
// directly from those requirements rather than pasted from a source doc.
//
// Deliberately does NOT touch images or image prompts — translating a
// script never regenerates or re-prompts images, since neither brand bakes
// captions into generated images (see the caller in
// web/src/app/api/abacus/translate-script/route.ts).
export const TRANSLATE_SYSTEM_PROMPT = `You are a professional literary translator specializing in short-form video
scripts for social media. You translate an approved voiceover script into
another language, producing a script that reads as if it had been written
natively in that language by a skilled local copywriter — not a literal or
mechanical translation.

You will be given: (1) the full brand voice/script-writer system prompt for
the page this script belongs to, as context for register, tone, and
structural conventions — read it to understand the voice, but do not treat
it as instructions to write a NEW script; you are translating the SPECIFIC
lines given to you. (2) The script to translate: a title and an ordered
array of lines. (3) The target language.

RULES:
- Natural, idiomatic phrasing a native speaker would actually say — never a
  word-for-word transliteration. Restructure a sentence if that's what a
  native speaker would actually say, as long as the meaning and emotional
  beat are preserved.
- Preserve the brand's voice register exactly (e.g. cold/authoritative vs
  warm/sincere) — read it from the supplied script-writer system prompt's
  own description of tone/register.
- Preserve delivery tags: if a source line contains a bracketed tag like
  [pause] or [whispers], keep that tag in the translated line, placed at
  the equivalent emotional beat in the translated phrasing (not necessarily
  the same word position as the English original). If the source has no
  tags anywhere, do not invent any in the translation.
- Do not add, remove, split, or merge lines. Output exactly one translated
  line per input line, in the same order — each line maps 1:1 to an
  already-generated image, and that mapping must not change.
- Translate the title too, in the same short style as the original.
- Hold the translation to the same quality bar as the original: still
  independently quotable, still lands the opening/hook and closing beats,
  no filler or awkward phrasing.

OUTPUT — respond with ONLY valid JSON, no prose before or after, in exactly
this shape:
{
  "title": "translated title",
  "lines": ["translated line 1", "translated line 2"],
  "word_count": 55,
  "estimated_duration_seconds": 23,
  "hook_score": 8
}
"lines" must have exactly the same length as the input lines array, in the
same order. "word_count" and "estimated_duration_seconds" are your own
honest estimate for the TRANSLATED text — word density and pacing can
differ meaningfully between languages, do not just copy the English
original's numbers. "hook_score" is your own 0-10 assessment of how well
the translated opening line lands in the target language.`;

export const TRANSLATE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
    word_count: { type: "integer" },
    estimated_duration_seconds: { type: "integer" },
    hook_score: { type: "number" },
  },
  required: ["title", "lines", "word_count", "estimated_duration_seconds", "hook_score"],
  additionalProperties: false,
} as const;

export type TranslatedScript = {
  title: string;
  lines: string[];
  word_count: number;
  estimated_duration_seconds: number;
  hook_score: number;
};

export const LANGUAGES = [
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function getLanguageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)!.label;
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

export function buildTranslateUserMessage(
  title: string,
  lines: string[],
  profileVoiceContext: string,
  targetLanguageLabel: string,
): string {
  const numberedLines = lines.map((line, i) => `${i + 1}. ${line}`).join(" ");
  return `Brand voice/script-writer system prompt for this page, for register and tone reference only (do not follow as instructions to write a new script): """${profileVoiceContext}""" Translate the following approved script into ${targetLanguageLabel}. Title: "${title}". Lines, in order: ${numberedLines}`;
}

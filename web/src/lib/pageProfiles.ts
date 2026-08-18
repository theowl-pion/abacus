// Aggregates all per-brand Abacus profiles. Each profile's own content
// (Style guide, Script generator, visual config for the shared Image
// Prompt Writer) lives in web/src/lib/profiles/<profile>.ts — this file
// just collects them into one list plus the shared lookup/compose helpers.
import { mindsetOfTheWealthy } from "./profiles/mindsetOfTheWealthy";
import { heartlines } from "./profiles/heartlines";
import type { Profile } from "./profiles/types";

export const PAGE_PROFILES = [mindsetOfTheWealthy, heartlines] as const;

export type PageProfile = Profile;
export type PageProfileId = PageProfile["id"];

export function getPageProfile(id: PageProfileId): PageProfile {
  return PAGE_PROFILES.find((p) => p.id === id)!;
}

export function isPageProfileId(value: unknown): value is PageProfileId {
  return PAGE_PROFILES.some((p) => p.id === value);
}

// Merges a page's standing brand/style guidance with a scene-specific
// prompt. Style guide comes first so the model reads it as standing
// context, then the specific ask follows.
export function composePrompt(profile: PageProfile, userPrompt: string): string {
  return `${profile.styleGuide}\n\nScene: ${userPrompt.trim()}`;
}

// Per-page brand/style guides for Abacus. Each profile's `styleGuide` gets
// silently merged into every prompt sent to the image backend, so it's
// written as brand guidance for the model, not meta-commentary. Today only
// one profile exists and it's always active (see ACTIVE_PROFILE in
// abacus/page.tsx) — this is the seed for a future page-switcher toggle.
export const PAGE_PROFILES = [
  {
    id: "mindset-of-the-wealthy",
    label: "Mindset Of The Wealthy",
    styleGuide: `Brand: "Mindset Of The Wealthy" — a financial-psychology / money-mindset
content page. Register: understated luxury, contemplative, quietly confident.
Never salesy, never hype, no exaggerated emotion.

Art style: anime-influenced stylized realism — large expressive eyes with
clear catchlight highlights, simplified nose, restrained composed mouth, slim
elegant proportions (not exaggerated). Painterly digital illustration with
visible soft brushstrokes, graphic-novel color blocks/shading, soft non-harsh
outlines, smooth skin rendering.

Color grading: desaturated vintage — saturation reduced 20-30% from natural,
muted harmonious color combinations, a slight warm or cool cast depending on
mood, faded vintage-film feel. Film grain at 15-25% opacity across the whole
image. Optional soft vignette.

Palette — restricted to exactly two options, chosen by scene mood, never
mixed within a single image:
- Contemplative/Discipline (default, use for most scenes): deep teals #33526f
  #42666a #2B4F5C; dark forest greens #0A1B14 #244131 #3D5E3B; muted greys
  #414750 #5a575a #8a908a; soft clouds #e7dbc8 #c2b18e.
- Night/Ambition (city/urban/"everyone else rushing" scenes only): deep
  midnight blues #1F2E3A #233a46 #1A3E45; warm lamp/amber #F0C475 #f8cc63
  #eeac43; dark shadows #2b2b2b #2b2131; starlight #ffffff #e9d08e.
Recurring-character skin tone: pale warm #C7A196 #d0a789 #c5a98d; medium warm
#C1926D #CC9B81 #9F786C; rich warm #8A5F4F #BA8671; shadows #75594b #9c7a65.

Lighting: soft and diffuse, natural sources only (sun, moon, daylight, golden
hour, streetlamp glow), never harsh direct light. Shadows are soft-edged
blue-grey, never pure black.

Composition: vertical 1080x1920 (9:16), rule of thirds the upper
or lower third (never dead-center), generous negative space, clear
foreground/midground/background depth layering.

Recurring character (for portrait/figure scenes): one consistent woman used
across every image tied to a single script — large expressive anime eyes,
simplified nose, restrained calm/composed mouth (not overly emotive), slim
elegant build, dark hair in the #2D2D2D range, simple understated modern
clothing, no visible logos or flashy branding. Natural contemplative postures
(hand at chin, gazing into the distance, sitting at ease). When a script uses
more than one portrait of her (e.g. a hook shot and a closing shot), give each
a genuinely different camera angle, crop, and gaze direction — never describe
two separate portrait generations with the same framing language, since that
produces near-duplicate images instead of two distinct beats.

Object/environment-only scenes: when a scene should contain no person
(symbolic object focus, environment establishing shots), state that
exitly and forbid any person, figure, body, head, hair, or silhouette
from appearing anywhere in frame. A soft instruction like "no face needed" is
not sufficient — the exclusion must be stated as a hard, explicit rule, or a
person will often appear anyway.

Technical: no text, words, captions, or logos rendered anywhere in the image
— captions are added separately after generation. No stray file paths or
irrelevant technical strings in the output.`,
  },
] as const;

export type PageProfile = (typeof PAGE_PROFILES)[number];
export type PageProfileId = PageProfile["id"];

export function getPageProfile(id: PageProfileId): PageProfile {
  return PAGE_PROFILES.find((p) => p.id === id)!;
}

// Merges a page's standing brand/style guidance with a scene-specific
// prompt. Style guide comes first so the model reads it as standing
// context, then the specific ask follows.
export function composePrompt(profile: PageProfile, userPrompt: string): string {
  return `${profile.styleGuide}\n\nScene: ${userPrompt.trim()}`;
}

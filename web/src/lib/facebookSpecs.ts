export type ImageType = "profile" | "cover";

export const FACEBOOK_SPECS: Record<
  ImageType,
  {
    label: string;
    aspectRatio: string;
    width: number;
    height: number;
    examplePrompt: string;
  }
> = {
  profile: {
    label: "Profile picture",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    examplePrompt:
      'A minimalist, high-end monogram logo for a quiet luxury brand featuring the overlapping letters "MW" in the center. The typography is a ultra-clean, elegant serif font, razor-sharp details. The color of the letters is a subtle, matte champagne gold with zero shine. The background is a solid, clean, textured dark charcoal gray paper texture, almost black. No gradients, no glowing effects, no reflections, extremely flat and sophisticated design, studio lighting, vector style, centered composition inside a circular safe-zone format, subtle film grain for a quiet-luxury feel.',
  },
  cover: {
    label: "Cover photo",
    // Facebook's real cover ratio (~2.63:1 — 820x312 display, 1640x624 for
    // a crisp retina upload) has no matching AI aspect-ratio preset, so we
    // generate at the closest wide preset (16:9) and crop precisely to the
    // real spec server-side (see api/lab/generate/[taskId]/route.ts).
    aspectRatio: "16:9",
    width: 1640,
    height: 624,
    examplePrompt:
      "A cinematic, ultra-premium wide banner shot representing quiet luxury and financial power. A modern, dark-architectural penthouse office interior at night overlooking a dim, out-of-focus city skyline. In the center, there is plenty of clean, dark empty space for text overlay. The color palette consists of deep matte blacks, charcoal grays, and extremely subtle warm ambient lighting. Sophisticated, elite, wealthy atmosphere, architectural digest style, shot on 35mm lens, moody lighting, low contrast, high-end professional photography, clean background, subtle film grain for a quiet-luxury feel.",
  },
};

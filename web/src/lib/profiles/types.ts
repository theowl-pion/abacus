// Shared types for per-brand Abacus profiles. Each profile bundles its own
// Style guide, Script generator, and the inputs the SHARED Image Prompt
// Writer needs (role labels, scene menu, palette names, character policy,
// style-lock sentence) — see web/src/lib/imagePromptWriterPrompt.ts for why
// the image-prompt-writer document itself is shared, not forked per brand.

export type RoleLabels = {
  first: string;
  message: string;
  penultimate: string;
  last: string;
};

export type VisualConfig = {
  sceneTypes: string;
  paletteNames: string;
  characterPolicy: string;
  styleLockSentence: string;
};

export type Profile = {
  id: string;
  label: string;
  styleGuide: string;
  scriptSystemPrompt: string;
  roleLabels: RoleLabels;
  visualConfig: VisualConfig;
};

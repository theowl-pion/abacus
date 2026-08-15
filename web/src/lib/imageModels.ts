// Curated set of kie.ai text-to-image models. Exact `model` id strings
// confirmed against docs.kie.ai/market/* — these are NOT the doc URL slugs,
// which sometimes differ from the actual API parameter value.
export const IMAGE_MODELS = [
  { id: "gpt-image-2-text-to-image", label: "GPT Image 2" },
  { id: "gpt-image/1.5-text-to-image", label: "GPT Image 1.5" },
  { id: "google/nano-banana", label: "Nano Banana" },
  { id: "nano-banana-2", label: "Nano Banana 2" },
  { id: "google/imagen4-ultra", label: "Imagen 4 Ultra" },
  { id: "flux-2/pro-text-to-image", label: "Flux 2 Pro" },
  { id: "ideogram/v3-text-to-image", label: "Ideogram v3" },
  { id: "seedream/4.5-text-to-image", label: "Seedream 4.5" },
  { id: "qwen3/pro-text-to-image", label: "Qwen3 Pro" },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export function isImageModelId(value: unknown): value is ImageModelId {
  return IMAGE_MODELS.some((m) => m.id === value);
}

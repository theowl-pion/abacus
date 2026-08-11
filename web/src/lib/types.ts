export type PaletteName = "cream" | "dark" | "warm-neutral";

export type PaletteInfo = {
  id: number;
  name: PaletteName;
  swatch: string;
  textColor: string;
};

export type QuoteCard = {
  quoteId: number;
  caption: string;
  language: string;
  images: Partial<Record<PaletteName, { wallpaperId: number; url: string }>>;
};

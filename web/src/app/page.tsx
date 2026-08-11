import { supabase, wallpaperPublicUrl } from "@/lib/supabase";
import PackBuilder from "@/components/PackBuilder";
import type { PaletteInfo, PaletteName, QuoteCard } from "@/lib/types";

type PaletteRow = {
  id: number;
  name: PaletteName;
  bg_bottom: string;
  text_color: string;
};

type WallpaperRow = {
  id: number;
  image_path: string;
  quote_id: number;
  quote: { text: string; language: string } | null;
  palette: { name: PaletteName } | null;
};

export default async function Home() {
  const { data: paletteRows, error: paletteError } = await supabase
    .from("palettes")
    .select("id, name, bg_bottom, text_color")
    .order("id")
    .returns<PaletteRow[]>();

  if (paletteError) {
    throw new Error(`Failed to load palettes: ${paletteError.message}`);
  }

  const palettes: PaletteInfo[] = (paletteRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    swatch: p.bg_bottom,
    textColor: p.text_color,
  }));

  const { data, error } = await supabase
    .from("wallpapers")
    .select("id, image_path, quote_id, quote:quotes(text, language), palette:palettes(name)")
    .order("quote_id")
    .returns<WallpaperRow[]>();

  if (error) {
    throw new Error(`Failed to load catalog: ${error.message}`);
  }

  const cardsByQuote = new Map<number, QuoteCard>();
  for (const w of data ?? []) {
    if (!w.quote || !w.palette) continue;
    let card = cardsByQuote.get(w.quote_id);
    if (!card) {
      card = {
        quoteId: w.quote_id,
        caption: w.quote.text.replace(/\|/g, " "),
        language: w.quote.language,
        images: {},
      };
      cardsByQuote.set(w.quote_id, card);
    }
    card.images[w.palette.name] = {
      wallpaperId: w.id,
      url: wallpaperPublicUrl(w.image_path),
    };
  }

  const cards = Array.from(cardsByQuote.values()).sort(
    (a, b) => a.quoteId - b.quoteId,
  );

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <PackBuilder cards={cards} palettes={palettes} />
    </div>
  );
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const PACK_SIZE = 5;
const PALETTE_COUNT = 3;

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { quoteIds?: unknown };
  const quoteIds = Array.isArray(body.quoteIds)
    ? body.quoteIds.filter((id): id is number => typeof id === "number")
    : [];

  if (quoteIds.length !== PACK_SIZE) {
    return NextResponse.json({ error: "invalid_selection" }, { status: 400 });
  }

  // Each selected quote delivers all 3 palette versions — expand the 5
  // quote ids into their matching `wallpapers` rows (should total 15).
  const { data: wallpapers, error } = await supabase
    .from("wallpapers")
    .select("id")
    .in("quote_id", quoteIds);

  if (error || !wallpapers || wallpapers.length !== PACK_SIZE * PALETTE_COUNT) {
    return NextResponse.json({ error: "invalid_selection" }, { status: 400 });
  }

  const wallpaperIds = wallpapers.map((w) => w.id);

  const stripe = new Stripe(secretKey);
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const idsParam = wallpaperIds.join(",");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          // TEMP: testing price, revert to 250 (2.50€) before going live.
          unit_amount: 100,
          product_data: {
            name: "Vettos — 5-Wallpaper Pack",
            description:
              "5 quotes, all 3 palettes, 15 wallpapers total. You'll get your download link right below, and a copy by email.",
          },
        },
      },
    ],
    metadata: {
      wallpaper_ids: idsParam,
    },
    success_url: `${origin}/order/success?ids=${idsParam}`,
    cancel_url: origin,
  });

  return NextResponse.json({ url: session.url });
}

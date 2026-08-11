"use client";

import { useEffect, useState } from "react";
import LockScreenCard from "@/components/LockScreenCard";
import QuoteRow from "@/components/QuoteRow";
import { CloseIcon } from "@/components/icons";
import { startCheckout } from "@/lib/checkout";
import type { PaletteInfo, PaletteName, QuoteCard } from "@/lib/types";

const PACK_SIZE = 5;
const PACK_PRICE = "1€"; // TEMP: testing price, revert to "2.50€" before going live.
const DETAIL_TRANSITION_MS = 200;
const TOAST_TRANSITION_MS = 200;

type ToastId = "welcome" | "checkoutHint" | "storeNotConnected";

export default function PackBuilder({
  cards,
  palettes,
}: {
  cards: QuoteCard[];
  palettes: PaletteInfo[];
}) {
  const defaultPalette = palettes[0]?.name ?? "cream";

  const [activePalette, setActivePalette] = useState<
    Record<number, PaletteName>
  >(() =>
    Object.fromEntries(cards.map((c) => [c.quoteId, defaultPalette])),
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [openQuoteId, setOpenQuoteId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<"all" | "en" | "it">(
    "all",
  );

  const filteredCards = cards.filter(
    (c) => languageFilter === "all" || c.language === languageFilter,
  );

  const description =
    languageFilter === "it"
      ? "Scegli 5 frasi e ricevi 15 sfondi (tutte e 3 le palette incluse) per 1€."
      : "Pick any 5 quotes and get 15 wallpapers (all 3 palettes included) for 1€.";

  const [toastId, setToastId] = useState<ToastId | null>("welcome");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setToastVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function showToast(id: ToastId) {
    setToastId((prev) => {
      if (prev === null) {
        requestAnimationFrame(() => setToastVisible(true));
      } else {
        setToastVisible(true);
      }
      return id;
    });
  }

  function closeToast() {
    setToastVisible(false);
    setTimeout(() => setToastId(null), TOAST_TRANSITION_MS);
  }

  const remaining = PACK_SIZE - selected.length;
  const checkoutHintMessage =
    languageFilter === "it"
      ? remaining === PACK_SIZE
        ? "Scegli 5 frasi per sbloccare il checkout — tocca una card per aggiungerla. Ogni frase include tutte e 3 le palette, 15 sfondi in totale, per 1€."
        : `Scegli ancora ${remaining} frase${remaining === 1 ? "" : "i"} per completare il tuo pacchetto da 5 e sbloccare il checkout.`
      : remaining === PACK_SIZE
        ? "Pick 5 quotes to unlock checkout — tap any card to add it. Each quote includes all 3 palettes, 15 wallpapers total, for 1€."
        : `Pick ${remaining} more quote${remaining === 1 ? "" : "s"} to complete your 5-quote pack and unlock checkout.`;

  const storeNotConnectedMessage =
    languageFilter === "it"
      ? "Il negozio non è ancora collegato — riprova più tardi."
      : "The store isn't connected yet — check back soon.";

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function handleCheckoutClick() {
    if (!isFull) {
      showToast("checkoutHint");
      return;
    }
    setCheckoutLoading(true);
    const url = await startCheckout(selected);
    setCheckoutLoading(false);
    if (!url) {
      showToast("storeNotConnected");
      return;
    }
    window.location.href = url;
  }

  function toggle(quoteId: number) {
    setSelected((prev) => {
      if (prev.includes(quoteId)) return prev.filter((x) => x !== quoteId);
      if (prev.length >= PACK_SIZE) return prev;
      return [...prev, quoteId];
    });
  }

  function openDetail(quoteId: number) {
    setOpenQuoteId(quoteId);
    requestAnimationFrame(() => setDetailVisible(true));
  }

  function closeDetail() {
    setDetailVisible(false);
    setTimeout(() => setOpenQuoteId(null), DETAIL_TRANSITION_MS);
  }

  useEffect(() => {
    document.body.style.overflow = openQuoteId !== null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openQuoteId]);

  const isFull = selected.length === PACK_SIZE;
  const openCard = cards.find((c) => c.quoteId === openQuoteId) ?? null;
  const openPalette = openQuoteId
    ? (activePalette[openQuoteId] ?? defaultPalette)
    : defaultPalette;
  const openImage = openCard?.images[openPalette];
  const openTextColor =
    palettes.find((p) => p.name === openPalette)?.textColor ?? "#000000";

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:block md:h-auto md:overflow-visible">
      <div className="flex-shrink-0 px-4 pt-4 md:sticky md:top-0 md:z-10 md:pt-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-black/10 bg-white/70 px-4 py-3.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="flex-shrink-0 text-xl font-bold tracking-tight text-black dark:text-white">
                Vettos
              </h1>
              <div className="flex items-center gap-1">
                {(["all", "en", "it"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguageFilter(lang)}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition ${
                      languageFilter === lang
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                    }`}
                  >
                    {lang === "all" ? "All" : lang === "en" ? "EN" : "IT"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-xs font-medium whitespace-nowrap text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
              <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-black dark:border-white/10 dark:bg-white/10 dark:text-white">
                {selected.length}/{PACK_SIZE} selected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: App Switcher style peek-scroll stack, sized to fit between nav and footer */}
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-8 py-3 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filteredCards.map((card) => {
          const palette = activePalette[card.quoteId] ?? defaultPalette;
          const image = card.images[palette];
          if (!image) return null;
          const textColor =
            palettes.find((p) => p.name === palette)?.textColor ?? "#000000";
          return (
            <div
              key={card.quoteId}
              className="aspect-[1284/2778] h-full flex-shrink-0 snap-center"
            >
              <LockScreenCard
                caption={card.caption}
                imageUrl={image.url}
                textColor={textColor}
                isSelected={selected.includes(card.quoteId)}
                onToggleSelect={() => toggle(card.quoteId)}
                onOpenDetail={() => openDetail(card.quoteId)}
                showControls={false}
                fitHeight
              />
            </div>
          );
        })}
      </div>

      {/* Desktop: vertical list, 3 palettes per row */}
      <div className="hidden flex-col gap-8 px-4 py-6 pb-32 md:flex md:gap-10">
        {filteredCards.map((card) => (
          <QuoteRow
            key={card.quoteId}
            card={card}
            palettes={palettes}
            activePalette={activePalette[card.quoteId] ?? defaultPalette}
            onChangePalette={(name) =>
              setActivePalette((prev) => ({ ...prev, [card.quoteId]: name }))
            }
            isSelected={selected.includes(card.quoteId)}
            onToggleSelect={() => toggle(card.quoteId)}
          />
        ))}
      </div>

      <div className="flex-shrink-0 p-4 md:fixed md:inset-x-0 md:bottom-0 md:z-10">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={handleCheckoutClick}
            disabled={checkoutLoading}
            className={`w-full rounded-full py-3.5 text-base font-semibold shadow-lg transition disabled:cursor-wait ${
              isFull
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "cursor-pointer bg-black/30 text-white dark:bg-white/30 dark:text-black"
            }`}
          >
            {checkoutLoading ? "Redirecting…" : `Checkout — ${PACK_PRICE}`}
          </button>
        </div>
      </div>

      {openCard && openImage && (
        <div
          className={`fixed inset-0 z-50 flex flex-col bg-zinc-50 transition-opacity dark:bg-black md:hidden ${
            detailVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDuration: `${DETAIL_TRANSITION_MS}ms` }}
        >
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              type="button"
              onClick={closeDetail}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-black dark:bg-white/10 dark:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div
            className={`flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pb-8 pt-2 transition-transform ${
              detailVisible ? "scale-100" : "scale-95"
            }`}
            style={{ transitionDuration: `${DETAIL_TRANSITION_MS}ms` }}
          >
            <div className="w-full max-w-xs">
              <LockScreenCard
                caption={openCard.caption}
                imageUrl={openImage.url}
                textColor={openTextColor}
                isSelected={selected.includes(openCard.quoteId)}
                onToggleSelect={() => toggle(openCard.quoteId)}
              />
            </div>

            <div className="flex items-center gap-3">
              {palettes.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() =>
                    setActivePalette((prev) => ({
                      ...prev,
                      [openCard.quoteId]: p.name,
                    }))
                  }
                  title={p.name}
                  aria-label={`Preview ${p.name} palette`}
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition dark:ring-offset-black ${
                    openPalette === p.name
                      ? "ring-[#0A84FF]"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: p.swatch }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => toggle(openCard.quoteId)}
              className={`w-full max-w-xs rounded-full py-3.5 text-base font-semibold transition ${
                selected.includes(openCard.quoteId)
                  ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                  : "bg-[#0A84FF] text-white"
              }`}
            >
              {selected.includes(openCard.quoteId)
                ? "Remove from Pack"
                : "Add to Pack"}
            </button>
          </div>
        </div>
      )}

      {toastId && (
        <div
          className={`fixed top-4 right-4 z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-black/10 bg-white/90 p-4 shadow-xl backdrop-blur-xl transition-all dark:border-white/10 dark:bg-zinc-900/90 ${
            toastVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0"
          }`}
          style={{ transitionDuration: `${TOAST_TRANSITION_MS}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug text-zinc-700 dark:text-zinc-200">
              {toastId === "welcome"
                ? description
                : toastId === "checkoutHint"
                  ? checkoutHintMessage
                  : storeNotConnectedMessage}
            </p>
            <button
              type="button"
              onClick={closeToast}
              aria-label="Close"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

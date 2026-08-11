"use client";

import { useEffect, useRef, useState } from "react";
import LockScreenCard from "@/components/LockScreenCard";
import type { PaletteInfo, PaletteName, QuoteCard } from "@/lib/types";

export default function QuoteRow({
  card,
  palettes,
  activePalette,
  onChangePalette,
  isSelected,
  onToggleSelect,
}: {
  card: QuoteCard;
  palettes: PaletteInfo[];
  activePalette: PaletteName;
  onChangePalette: (name: PaletteName) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  const activeSwatch =
    palettes.find((p) => p.name === activePalette)?.swatch ?? "#cccccc";

  return (
    <div className="mx-auto w-full max-w-sm md:max-w-4xl">
      <div className="flex flex-col gap-3 md:flex-row md:gap-4">
        {palettes.map((p) => {
          const image = card.images[p.name];
          if (!image) return null;
          const isActiveOnMobile = p.name === activePalette;
          return (
            <div
              key={p.name}
              className={`${isActiveOnMobile ? "block" : "hidden md:block"} md:flex-1`}
            >
              <LockScreenCard
                caption={card.caption}
                imageUrl={image.url}
                textColor={p.textColor}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
              />
            </div>
          );
        })}
      </div>

      <div ref={pickerRef} className="relative mt-2 flex justify-center md:hidden">
        {pickerOpen && (
          <div className="absolute bottom-full mb-2 flex items-center gap-2 rounded-full border border-black/5 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95">
            {palettes.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  onChangePalette(p.name);
                  setPickerOpen(false);
                }}
                title={p.name}
                aria-label={`Preview ${p.name} palette`}
                className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition dark:ring-offset-zinc-900 ${
                  activePalette === p.name
                    ? "ring-[#0A84FF]"
                    : "ring-transparent"
                }`}
                style={{ backgroundColor: p.swatch }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span
            className="h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: activeSwatch }}
          />
          Palette
        </button>
      </div>
    </div>
  );
}

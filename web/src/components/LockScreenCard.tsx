"use client";

import { useState } from "react";
import Image from "next/image";
import { Oswald } from "next/font/google";
import {
  BatteryIcon,
  CameraIcon,
  CheckIcon,
  EyeIcon,
  FlashlightIcon,
  NextIcon,
  PauseIcon,
  PrevIcon,
  SignalIcon,
  SpeakerIcon,
} from "@/components/icons";

const SELECTION_BLUE = "#0A84FF";

const clockFont = Oswald({ weight: "500", subsets: ["latin"] });

export default function LockScreenCard({
  caption,
  imageUrl,
  textColor,
  isSelected,
  onToggleSelect,
  onOpenDetail,
  showControls = true,
  fitHeight = false,
}: {
  caption: string;
  imageUrl: string;
  textColor: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenDetail?: () => void;
  showControls?: boolean;
  fitHeight?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"preview" | "original">("preview");
  const isPreview = viewMode === "preview";

  return (
    <div className={fitHeight ? "h-full w-full" : "w-full"}>
      <div
        className={`relative w-full ${fitHeight ? "h-full" : ""}`}
        style={{ containerType: "inline-size" }}
      >
        <button
          type="button"
          onClick={onOpenDetail ?? onToggleSelect}
          aria-label={caption}
          className={`relative block w-full overflow-hidden rounded-[30px] border border-black/10 shadow-xl transition active:scale-[0.98] dark:border-white/10 ${
            fitHeight ? "h-full" : "aspect-[1284/2778]"
          }`}
        >
          <Image
            src={imageUrl}
            alt={caption}
            fill
            unoptimized
            className="object-cover"
          />

          {isPreview && (
            <>
              <div
                className="absolute inset-x-0 top-0 flex items-center justify-end gap-[1.6cqw] px-[6.3cqw] pt-[5.2cqw]"
                style={{ color: textColor }}
              >
                <SignalIcon className="w-[4.7cqw]" />
                <span className="text-[3.4cqw] font-medium">5G</span>
                <BatteryIcon className="w-[6.5cqw]" />
              </div>

              <div
                className="absolute inset-x-0 top-[14.6cqw] flex flex-col items-center"
                style={{ color: textColor }}
              >
                <span className="text-[4.2cqw] font-medium opacity-90">
                  Thursday, August 6
                </span>
                <span
                  className={`${clockFont.className} text-[54cqw] leading-none tracking-tight`}
                >
                  9:41
                </span>
              </div>

              <div className="absolute inset-x-[6.3cqw] bottom-[25cqw] rounded-[9.5cqw] bg-white/90 p-[4.4cqw] shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-[3.6cqw]">
                  <div className="relative h-[15cqw] w-[15cqw] flex-shrink-0 overflow-hidden rounded-[3.4cqw]">
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[4.2cqw] font-semibold text-zinc-900">
                      {caption}
                    </p>
                    <p className="truncate text-[4.2cqw] text-zinc-500">
                      Now Playing
                    </p>
                  </div>
                </div>
                <div className="mt-[3.9cqw] flex items-center gap-[2.4cqw]">
                  <span className="text-[3cqw] tabular-nums text-zinc-500">
                    2:04
                  </span>
                  <div className="h-[1.9cqw] flex-1 rounded-full bg-zinc-300">
                    <div className="h-[1.9cqw] w-1/3 rounded-full bg-zinc-700" />
                  </div>
                  <span className="text-[3cqw] tabular-nums text-zinc-500">
                    -0:51
                  </span>
                </div>
                <div className="mt-[3.8cqw] flex items-center justify-between text-zinc-800">
                  <div className="flex flex-1 items-center justify-center gap-[8cqw]">
                    <PrevIcon className="w-[6cqw]" />
                    <PauseIcon className="w-[7cqw]" />
                    <NextIcon className="w-[6cqw]" />
                  </div>
                  <SpeakerIcon className="w-[5.5cqw]" />
                </div>
              </div>

              <div className="absolute inset-x-[6.3cqw] bottom-[9.4cqw] flex items-center justify-between">
                <span className="flex h-[11.5cqw] w-[11.5cqw] items-center justify-center rounded-full bg-white/85 text-zinc-800 shadow backdrop-blur-md">
                  <FlashlightIcon className="w-[4.7cqw]" />
                </span>
                <span className="flex h-[11.5cqw] w-[11.5cqw] items-center justify-center rounded-full bg-white/85 text-zinc-800 shadow backdrop-blur-md">
                  <CameraIcon className="w-[4.7cqw]" />
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-[2.1cqw] flex justify-center">
                <div className="h-[1cqw] w-[29cqw] rounded-full bg-white/70" />
              </div>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          aria-pressed={isSelected}
          aria-label={isSelected ? "Remove from pack" : "Add to pack"}
          className="absolute left-[3.1cqw] top-[3.1cqw] flex h-[7.3cqw] w-[7.3cqw] items-center justify-center rounded-full transition-all duration-200"
          style={{
            backgroundColor: isSelected ? SELECTION_BLUE : "rgba(0,0,0,0.25)",
            boxShadow: isSelected
              ? "0 2px 8px rgba(10,132,255,0.5)"
              : "0 1px 4px rgba(0,0,0,0.3)",
            border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.7)",
            backdropFilter: "blur(6px)",
          }}
        >
          {isSelected && <CheckIcon className="w-[4.2cqw] text-white" />}
        </button>
      </div>

      {showControls && (
        <div className="mt-2 flex items-center justify-center">
          <button
            type="button"
            onClick={() =>
              setViewMode((v) => (v === "preview" ? "original" : "preview"))
            }
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            {isPreview ? "Original" : "Preview"}
          </button>
        </div>
      )}
    </div>
  );
}

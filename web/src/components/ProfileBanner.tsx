"use client";

import Image from "next/image";
import type { PageProfile, PageProfileId } from "@/lib/pageProfiles";

export default function ProfileBanner({
  profiles,
  activeProfileId,
  onSelect,
  disabled,
}: {
  profiles: readonly PageProfile[];
  activeProfileId: PageProfileId;
  onSelect: (id: PageProfileId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {profiles.map((profile) => {
        const active = profile.id === activeProfileId;
        return (
          <button
            key={profile.id}
            type="button"
            onClick={() => onSelect(profile.id)}
            disabled={disabled}
            className={`group relative h-28 overflow-hidden rounded-2xl text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? "ring-2 ring-black dark:ring-white"
                : "ring-1 ring-black/10 hover:ring-black/30 dark:ring-white/10 dark:hover:ring-white/30"
            }`}
          >
            <Image
              src={`/profile-banners/${profile.id}.jpg`}
              alt={`${profile.label} style preview`}
              fill
              unoptimized
              className="object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 flex items-center gap-2 p-3">
              <span className="text-sm font-semibold text-white drop-shadow">
                {profile.label}
              </span>
              {active && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  Active
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

import { supabase, wallpaperPublicUrl } from "@/lib/supabase";
import DownloadPack from "@/components/DownloadPack";
import { CheckIcon } from "@/components/icons";

type WallpaperRow = { id: number; image_path: string };

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const wallpaperIds = (ids ?? "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));

  if (wallpaperIds.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-black dark:text-white">
          Vettos
        </h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          No order found here. If you just completed checkout, check your
          email for the download link.
        </p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("wallpapers")
    .select("id, image_path")
    .in("id", wallpaperIds)
    .returns<WallpaperRow[]>();

  if (error) {
    throw new Error(`Failed to load order: ${error.message}`);
  }

  const items = (data ?? []).map((w) => ({
    url: wallpaperPublicUrl(w.image_path),
    filename: w.image_path,
  }));

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-xl font-bold tracking-tight text-black dark:text-white">
        Vettos
      </h1>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
        <CheckIcon className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-black dark:text-white">
          Thank you!
        </h2>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Your {items.length}-wallpaper pack is ready. We also emailed you
          this link, so it&apos;s safe to come back anytime.
        </p>
      </div>
      <DownloadPack items={items} />
    </div>
  );
}

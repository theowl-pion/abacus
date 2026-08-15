import Link from "next/link";
import Image from "next/image";
import { supabase, labImagePublicUrl } from "@/lib/supabase";
import DownloadImageButton from "@/components/DownloadImageButton";

type LabImageRow = {
  id: number;
  type: "profile" | "cover";
  model: string;
  prompt: string;
  image_path: string;
  width: number;
  height: number;
  created_at: string;
};

export default async function LabHistoryPage() {
  const { data, error } = await supabase
    .from("lab_images")
    .select("id, type, model, prompt, image_path, width, height, created_at")
    .order("created_at", { ascending: false })
    .returns<LabImageRow[]>();

  if (error) {
    throw new Error(`Failed to load history: ${error.message}`);
  }

  const items = data ?? [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            Image Lab — History
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {items.length} generated image{items.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href="/lab"
          className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          ← Back to Lab
        </Link>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nothing generated yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const url = labImagePublicUrl(item.image_path);
          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"
            >
              <div
                className={`relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${
                  item.type === "profile" ? "rounded-full" : "rounded-xl"
                }`}
                style={{ aspectRatio: `${item.width} / ${item.height}` }}
              >
                <Image
                  src={url}
                  alt={item.prompt}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-black dark:text-white">
                    {item.model}
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.type}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {item.prompt}
                </p>
              </div>
              <DownloadImageButton
                url={url}
                filename={item.image_path}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

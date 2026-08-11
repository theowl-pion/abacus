"use client";

import { useState } from "react";
import JSZip from "jszip";

export default function DownloadPack({
  items,
}: {
  items: { url: string; filename: string }[];
}) {
  const [status, setStatus] = useState<"idle" | "zipping" | "done" | "error">(
    "idle",
  );

  async function handleDownload() {
    setStatus("zipping");
    try {
      const zip = new JSZip();
      await Promise.all(
        items.map(async (item) => {
          const res = await fetch(item.url);
          const blob = await res.blob();
          zip.file(item.filename, blob);
        }),
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vettos-wallpapers.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === "zipping"}
        className="rounded-full bg-black px-6 py-3.5 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {status === "zipping"
          ? "Preparing your download…"
          : status === "done"
            ? "Downloaded — click to save again"
            : "Download your pack"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Something went wrong. Try again, or use the link in your email.
        </p>
      )}
    </div>
  );
}

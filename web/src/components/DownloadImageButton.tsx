"use client";

import { useState } from "react";

export default function DownloadImageButton({
  url,
  filename,
  className,
}: {
  url: string;
  filename: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={busy} className={className}>
      {busy ? "Downloading…" : "Download"}
    </button>
  );
}

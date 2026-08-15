"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FACEBOOK_SPECS, type ImageType } from "@/lib/facebookSpecs";
import { IMAGE_MODELS, type ImageModelId } from "@/lib/imageModels";
import DownloadImageButton from "@/components/DownloadImageButton";

type ResultStatus = "generating" | "done" | "error";
type Result = {
  model: ImageModelId;
  status: ResultStatus;
  imageUrl?: string;
  error?: string;
};

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 60; // ~4 minutes

export default function LabPage() {
  const [type, setType] = useState<ImageType>("profile");
  const [prompts, setPrompts] = useState<Record<ImageType, string>>({
    profile: FACEBOOK_SPECS.profile.examplePrompt,
    cover: FACEBOOK_SPECS.cover.examplePrompt,
  });
  const [selectedModels, setSelectedModels] = useState<ImageModelId[]>([
    "gpt-image-2-text-to-image",
  ]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const spec = FACEBOOK_SPECS[type];

  function selectType(next: ImageType) {
    setType(next);
    setResults([]);
    setFormError(null);
  }

  function toggleModel(id: ImageModelId) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function pollTask(taskId: string, model: ImageModelId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await fetch(
        `/api/lab/generate/${taskId}?type=${type}&model=${encodeURIComponent(
          model,
        )}&prompt=${encodeURIComponent(prompts[type])}`,
      );
      const data = await res.json();

      if (data.status === "failed") {
        setResults((prev) =>
          prev.map((r) =>
            r.model === model
              ? { ...r, status: "error", error: data.error }
              : r,
          ),
        );
        return;
      }
      if (data.status === "done") {
        setResults((prev) =>
          prev.map((r) =>
            r.model === model
              ? { ...r, status: "done", imageUrl: data.imageUrl }
              : r,
          ),
        );
        return;
      }
    }
    setResults((prev) =>
      prev.map((r) =>
        r.model === model
          ? { ...r, status: "error", error: "Timed out" }
          : r,
      ),
    );
  }

  async function handleGenerate() {
    if (selectedModels.length === 0) {
      setFormError("Pick at least one model.");
      return;
    }
    setFormError(null);
    setGenerating(true);
    setResults(selectedModels.map((model) => ({ model, status: "generating" })));

    try {
      const res = await fetch("/api/lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompts[type],
          type,
          models: selectedModels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start generation");

      const tasks = data.tasks as {
        model: ImageModelId;
        taskId: string | null;
        error: string | null;
      }[];

      await Promise.all(
        tasks.map((t) => {
          if (!t.taskId) {
            setResults((prev) =>
              prev.map((r) =>
                r.model === t.model
                  ? { ...r, status: "error", error: t.error ?? "Failed to start" }
                  : r,
              ),
            );
            return Promise.resolve();
          }
          return pollTask(t.taskId, t.model);
        }),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            Image Lab
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Experimental AI generator for Facebook profile pictures and cover
            photos, cropped to Facebook&apos;s real spec.
          </p>
        </div>
        <Link
          href="/lab/history"
          className="flex-shrink-0 rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          History →
        </Link>
      </div>

      <div className="flex gap-2">
        {(["profile", "cover"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectType(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              type === t
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {FACEBOOK_SPECS[t].label} ({FACEBOOK_SPECS[t].width}×
            {FACEBOOK_SPECS[t].height})
          </button>
        ))}
      </div>

      <textarea
        value={prompts[type]}
        onChange={(e) =>
          setPrompts((p) => ({ ...p, [type]: e.target.value }))
        }
        rows={8}
        className="w-full rounded-2xl border border-black/10 bg-white p-4 text-sm text-black dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-black dark:text-white">
          Models — pick one or more (each is a separate paid generation)
        </span>
        <div className="flex flex-wrap gap-2">
          {IMAGE_MODELS.map((m) => {
            const checked = selectedModels.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModel(m.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  checked
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 bg-transparent text-zinc-700 dark:border-white/15 dark:text-zinc-300"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-full bg-black px-6 py-3.5 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {generating
          ? "Generating…"
          : `Generate (${selectedModels.length} model${
              selectedModels.length === 1 ? "" : "s"
            } — ${selectedModels.length} paid generation${
              selectedModels.length === 1 ? "" : "s"
            })`}
      </button>

      {formError && (
        <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {results.map((r) => (
            <div
              key={r.model}
              className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/10"
            >
              <span className="text-sm font-semibold text-black dark:text-white">
                {IMAGE_MODELS.find((m) => m.id === r.model)?.label ?? r.model}
              </span>

              {r.status === "generating" && (
                <div
                  className="flex w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
                >
                  Generating… (can take about a minute)
                </div>
              )}

              {r.status === "error" && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {r.error}
                </p>
              )}

              {r.status === "done" && r.imageUrl && (
                <>
                  <div
                    className={`relative w-full overflow-hidden ${
                      type === "profile" ? "rounded-full" : "rounded-xl"
                    }`}
                    style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
                  >
                    <Image
                      src={r.imageUrl}
                      alt={`${r.model} result`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <DownloadImageButton
                    url={r.imageUrl}
                    filename={`vettos-${type}-${r.model.replace(/[^a-z0-9]+/gi, "-")}.png`}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

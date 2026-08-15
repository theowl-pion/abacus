"use client";

import { useState } from "react";
import Image from "next/image";
import DownloadImageButton from "@/components/DownloadImageButton";
import DownloadPack from "@/components/DownloadPack";

const MIN_SLOTS = 1;
const DEFAULT_SLOTS = 6;
const MAX_SLOTS = 12;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 60; // ~4 minutes
const OPENAI_CONCURRENCY = 3;

type SlotStatus = "idle" | "generating" | "done" | "error";
type Slot = {
  id: number;
  prompt: string;
  status: SlotStatus;
  imageUrl?: string;
  error?: string;
};
type Backend = "kie" | "openai";

let nextSlotId = DEFAULT_SLOTS;

function makeInitialSlots(): Slot[] {
  return Array.from({ length: DEFAULT_SLOTS }, (_, i) => ({
    id: i,
    prompt: "",
    status: "idle" as SlotStatus,
  }));
}

// Small fixed-concurrency worker pool — caps how many requests are in
// flight at once instead of firing all N in parallel with no limit.
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    await worker(items[i], i);
    return next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, next),
  );
}

export default function AbacusPage() {
  const [slots, setSlots] = useState<Slot[]>(makeInitialSlots);
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [backend, setBackend] = useState<Backend>("kie");

  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots((prev) => [
      ...prev,
      { id: nextSlotId++, prompt: "", status: "idle" },
    ]);
  }

  function removeSlot(id: number) {
    if (slots.length <= MIN_SLOTS) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function updatePrompt(id: number, prompt: string) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, prompt } : s)));
  }

  function updateSlot(id: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function pollTask(id: number, taskId: string) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const res = await fetch(`/api/abacus/generate/${taskId}`);
        const data = await res.json();

        if (data.status === "failed") {
          updateSlot(id, { status: "error", error: data.error ?? "Generation failed" });
          return;
        }
        if (data.status === "done") {
          updateSlot(id, { status: "done", imageUrl: data.imageDataUrl });
          return;
        }
      } catch (err) {
        updateSlot(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Network error while polling",
        });
        return;
      }
    }
    updateSlot(id, { status: "error", error: "Timed out" });
  }

  async function generateOpenAiSlot(id: number, prompt: string) {
    try {
      const res = await fetch("/api/abacus/generate-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateSlot(id, { status: "error", error: data.error ?? "Generation failed" });
        return;
      }
      updateSlot(id, { status: "done", imageUrl: data.imageDataUrl });
    } catch (err) {
      updateSlot(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleGenerateAll() {
    const active = slots.filter((s) => s.prompt.trim().length > 0);
    if (active.length === 0) {
      setFormError("Enter at least one prompt.");
      return;
    }
    setFormError(null);
    setGenerating(true);

    setSlots((prev) =>
      prev.map((s) =>
        s.prompt.trim().length > 0
          ? { ...s, status: "generating", imageUrl: undefined, error: undefined }
          : s,
      ),
    );

    try {
      if (backend === "openai") {
        await runPool(active, OPENAI_CONCURRENCY, (slot) =>
          generateOpenAiSlot(slot.id, slot.prompt),
        );
      } else {
        const res = await fetch("/api/abacus/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts: active.map((s) => s.prompt) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start batch");

        const tasks = data.tasks as {
          index: number;
          taskId: string | null;
          error: string | null;
        }[];

        await Promise.all(
          tasks.map((t) => {
            const slot = active[t.index];
            if (!slot) return Promise.resolve();
            if (!t.taskId) {
              updateSlot(slot.id, {
                status: "error",
                error: t.error ?? "Failed to start",
              });
              return Promise.resolve();
            }
            return pollTask(slot.id, t.taskId);
          }),
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const finishedItems = slots
    .filter((s) => s.status === "done" && s.imageUrl)
    .map((s) => ({
      url: s.imageUrl as string,
      filename: `abacus-${s.id}.jpg`,
    }));

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
          Abacus
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Batch image generation for content pipelines — paste one
          self-contained prompt per script line, generate them all at once.
          Each click is real, paid generation.
        </p>
      </div>

      <div className="inline-flex w-fit rounded-full border border-black/10 p-1 dark:border-white/10">
        <button
          type="button"
          onClick={() => setBackend("kie")}
          disabled={generating}
          className={
            backend === "kie"
              ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed dark:bg-white dark:text-black"
              : "rounded-full px-3 py-1 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed dark:text-zinc-400"
          }
        >
          kie.ai
        </button>
        <button
          type="button"
          onClick={() => setBackend("openai")}
          disabled={generating}
          className={
            backend === "openai"
              ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed dark:bg-white dark:text-black"
              : "rounded-full px-3 py-1 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed dark:text-zinc-400"
          }
        >
          OpenAI (gpt-image-2)
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {slots.map((slot, i) => (
          <div
            key={slot.id}
            className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-black dark:text-white">
                Prompt {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeSlot(slot.id)}
                disabled={slots.length <= MIN_SLOTS}
                className="text-xs font-semibold text-zinc-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-red-400"
              >
                Remove
              </button>
            </div>

            <textarea
              value={slot.prompt}
              onChange={(e) => updatePrompt(slot.id, e.target.value)}
              rows={4}
              placeholder="Full, self-contained image-generation prompt…"
              className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-black dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            />

            {slot.status === "generating" && (
              <div
                className="flex w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                style={{ aspectRatio: "9 / 16", maxHeight: "16rem" }}
              >
                Generating…
              </div>
            )}

            {slot.status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {slot.error}
              </p>
            )}

            {slot.status === "done" && slot.imageUrl && (
              <div className="flex flex-col items-start gap-2">
                <div
                  className="relative w-full max-w-[12rem] overflow-hidden rounded-xl"
                  style={{ aspectRatio: "9 / 16" }}
                >
                  <Image
                    src={slot.imageUrl}
                    alt={`Prompt ${i + 1} result`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <DownloadImageButton
                  url={slot.imageUrl}
                  filename={`abacus-${slot.id}.jpg`}
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSlot}
        disabled={slots.length >= MAX_SLOTS}
        className="self-start rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300"
      >
        + Add prompt ({slots.length}/{MAX_SLOTS})
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerateAll}
          disabled={generating}
          className="rounded-full bg-black px-6 py-3.5 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {generating ? "Generating…" : "Generate All"}
        </button>

        {finishedItems.length > 0 && (
          <DownloadPack
            items={finishedItems}
            zipFilename="abacus-images.zip"
            errorMessage="Something went wrong zipping the images. Try downloading them individually instead."
          />
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
      )}
    </div>
  );
}

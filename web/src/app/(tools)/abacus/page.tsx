"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import DownloadImageButton from "@/components/DownloadImageButton";
import DownloadPack from "@/components/DownloadPack";
import ProfileBanner from "@/components/ProfileBanner";
import Spinner from "@/components/Spinner";
import {
  PAGE_PROFILES,
  composePrompt,
  getPageProfile,
  isPageProfileId,
  type PageProfileId,
} from "@/lib/pageProfiles";
import { stripScriptTags, type GeneratedScript } from "@/lib/scriptSystemPrompt";
import {
  deriveLineRoles,
  type GeneratedImagePrompt,
} from "@/lib/imagePromptWriterPrompt";
import {
  LANGUAGES,
  isLanguageCode,
  type LanguageCode,
  type TranslatedScript,
} from "@/lib/translatePrompt";
import {
  getSession,
  putSession,
  clearSession,
  type ProfileSessionState,
} from "@/lib/abacusSession";

const MIN_SLOTS = 1;
const DEFAULT_SLOTS = 6;
const MAX_SLOTS = 12;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 60; // ~4 minutes
const OPENAI_CONCURRENCY = 3;
const PERSIST_DEBOUNCE_MS = 500;

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

function defaultProfileState(): ProfileSessionState {
  return {
    topicSteer: "",
    scriptInfo: null,
    imagePrompts: null,
    translatedScript: null,
    languageCode: LANGUAGES[0].code,
    slots: makeInitialSlots(),
  };
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "abacus-images";
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
  const [backend, setBackend] = useState<Backend>("openai");
  const [activeProfileId, setActiveProfileId] = useState<PageProfileId>(
    "mindset-of-the-wealthy",
  );
  const [topicSteer, setTopicSteer] = useState("");
  const [scriptInfo, setScriptInfo] = useState<GeneratedScript | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [imagePrompts, setImagePrompts] = useState<GeneratedImagePrompt[] | null>(null);
  const [imagePromptsLoading, setImagePromptsLoading] = useState(false);
  const [imagePromptsError, setImagePromptsError] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState<LanguageCode>(LANGUAGES[0].code);
  const [translatedScript, setTranslatedScript] = useState<TranslatedScript | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [cleanView, setCleanView] = useState(false);

  // Per-profile snapshots, keyed by profile id — each brand profile's
  // in-progress script/images are independent work. This ref is the
  // source of truth for every OTHER profile's state while the current one
  // lives in the React state above; selectProfile snapshots the outgoing
  // profile into it before swapping the incoming profile's saved state in.
  const profileSnapshots = useRef<Record<string, ProfileSessionState>>({});

  // Rehydrate from IndexedDB once on mount, so a refresh doesn't lose work.
  useEffect(() => {
    let cancelled = false;
    getSession().then((snapshot) => {
      if (cancelled || !snapshot) {
        setHydrated(true);
        return;
      }
      profileSnapshots.current = snapshot.profiles ?? {};
      const activeId = isPageProfileId(snapshot.activeProfileId)
        ? snapshot.activeProfileId
        : "mindset-of-the-wealthy";
      if (snapshot.backend === "kie" || snapshot.backend === "openai") {
        setBackend(snapshot.backend);
      }
      setActiveProfileId(activeId);
      const state = profileSnapshots.current[activeId] ?? defaultProfileState();
      setTopicSteer(state.topicSteer ?? "");
      setScriptInfo((state.scriptInfo as GeneratedScript | null) ?? null);
      setImagePrompts((state.imagePrompts as GeneratedImagePrompt[] | null) ?? null);
      setTranslatedScript((state.translatedScript as TranslatedScript | null) ?? null);
      if (isLanguageCode(state.languageCode)) {
        setLanguageCode(state.languageCode);
      }
      if (state.slots && state.slots.length > 0) {
        setSlots(state.slots as Slot[]);
        nextSlotId = Math.max(...state.slots.map((s) => s.id), DEFAULT_SLOTS) + 1;
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist (debounced) on change, once initial hydration is done — never
  // write before hydrating, or a fresh mount would overwrite a saved
  // session with the empty default state before it's had a chance to load.
  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      profileSnapshots.current[activeProfileId] = {
        topicSteer,
        scriptInfo,
        imagePrompts,
        translatedScript,
        languageCode,
        slots,
      };
      putSession({
        activeProfileId,
        backend,
        profiles: profileSnapshots.current,
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [
    hydrated,
    activeProfileId,
    backend,
    topicSteer,
    scriptInfo,
    imagePrompts,
    translatedScript,
    languageCode,
    slots,
  ]);

  // Warn before an accidental refresh/close, but only when there's
  // something real to lose.
  useEffect(() => {
    const hasWork = scriptInfo !== null || slots.some((s) => s.imageUrl);
    if (!hasWork) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [scriptInfo, slots]);

  function clearAll() {
    if (!window.confirm("Clear everything and start over? This can't be undone.")) {
      return;
    }
    profileSnapshots.current = {};
    setSlots(makeInitialSlots());
    setScriptInfo(null);
    setImagePrompts(null);
    setTranslatedScript(null);
    setTopicSteer("");
    setFormError(null);
    setScriptError(null);
    setImagePromptsError(null);
    setTranslateError(null);
    clearSession();
  }

  const activeProfile = getPageProfile(activeProfileId);

  function selectProfile(id: PageProfileId) {
    if (id === activeProfileId) return;

    // Snapshot the outgoing profile's live state before swapping — without
    // this, whatever the user just built on the current profile is lost
    // the moment they switch away, since only one profile's state lives in
    // React state at a time.
    profileSnapshots.current[activeProfileId] = {
      topicSteer,
      scriptInfo,
      imagePrompts,
      translatedScript,
      languageCode,
      slots,
    };

    const incoming = profileSnapshots.current[id] ?? defaultProfileState();
    setActiveProfileId(id);
    setTopicSteer(incoming.topicSteer);
    setScriptInfo((incoming.scriptInfo as GeneratedScript | null) ?? null);
    setImagePrompts((incoming.imagePrompts as GeneratedImagePrompt[] | null) ?? null);
    setTranslatedScript((incoming.translatedScript as TranslatedScript | null) ?? null);
    setLanguageCode(
      isLanguageCode(incoming.languageCode) ? incoming.languageCode : LANGUAGES[0].code,
    );
    setSlots(incoming.slots.length > 0 ? (incoming.slots as Slot[]) : makeInitialSlots());
    if (incoming.slots.length > 0) {
      nextSlotId = Math.max(...incoming.slots.map((s) => s.id), DEFAULT_SLOTS) + 1;
    }

    // Persist immediately rather than waiting for the debounce — a switch
    // is a natural save point, and if the tab closes right after, the
    // outgoing profile's work must already be durably saved.
    putSession({
      activeProfileId: id,
      backend,
      profiles: profileSnapshots.current,
    });
  }

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

  async function generateScript() {
    setScriptError(null);
    setScriptLoading(true);
    try {
      const res = await fetch("/api/abacus/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSteer, profileId: activeProfileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate script");

      const script = data.script as GeneratedScript;
      setScriptInfo(script);
      setImagePrompts(null);
      setTranslatedScript(null);
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScriptLoading(false);
    }
  }

  async function generateImagePrompts() {
    if (!scriptInfo) return;
    setImagePromptsError(null);
    setImagePromptsLoading(true);
    try {
      const res = await fetch("/api/abacus/generate-image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: scriptInfo.lines.map(stripScriptTags),
          profileId: activeProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to write image prompts");

      const prompts = data.prompts as GeneratedImagePrompt[];
      setImagePrompts(prompts);
      setSlots(
        prompts.map((p) => ({
          id: nextSlotId++,
          prompt: p.content_prompt,
          status: "idle" as SlotStatus,
        })),
      );
    } catch (err) {
      setImagePromptsError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImagePromptsLoading(false);
    }
  }

  async function generateTranslation() {
    if (!scriptInfo) return;
    setTranslateError(null);
    setTranslateLoading(true);
    try {
      const res = await fetch("/api/abacus/translate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scriptInfo.title,
          lines: scriptInfo.lines,
          profileId: activeProfileId,
          languageCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to translate script");

      setTranslatedScript(data.translation as TranslatedScript);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTranslateLoading(false);
    }
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
          generateOpenAiSlot(slot.id, composePrompt(activeProfile, slot.prompt)),
        );
      } else {
        const res = await fetch("/api/abacus/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompts: active.map((s) => composePrompt(activeProfile, s.prompt)),
          }),
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

  const scriptLineRoles = scriptInfo
    ? deriveLineRoles(scriptInfo.lines, activeProfile.roleLabels)
    : [];

  const finishedItems = slots
    .filter((s) => s.status === "done" && s.imageUrl)
    .map((s) => ({
      url: s.imageUrl as string,
      filename: `abacus-${s.id}.jpg`,
    }));

  const busy = generating || scriptLoading || imagePromptsLoading;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-y-auto overflow-x-auto rounded-2xl border border-black/10 p-8 dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            Abacus
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Idea → script → image prompts → images. Each click past the idea
            stage is real, paid generation.
          </p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="flex-shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
        >
          Clear session
        </button>
      </div>

      <ProfileBanner
        profiles={PAGE_PROFILES}
        activeProfileId={activeProfileId}
        onSelect={selectProfile}
        disabled={busy}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-black dark:text-white">1. Idea</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguageCode(lang.code)}
                disabled={translateLoading}
                className={
                  languageCode === lang.code
                    ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed dark:bg-white dark:text-black"
                    : "rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-500 disabled:cursor-not-allowed dark:border-white/10 dark:text-zinc-400"
                }
              >
                {lang.label}
              </button>
            ))}
            <button
              type="button"
              onClick={generateTranslation}
              disabled={translateLoading || !scriptInfo}
              className="flex items-center justify-center gap-2 rounded-full bg-zinc-800 px-4 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-200 dark:text-black"
            >
              {translateLoading && <Spinner className="h-3 w-3" />}
              {translateLoading ? "Translating…" : "Translate"}
            </button>
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
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={generateScript}
            disabled={scriptLoading}
            className="flex items-center justify-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-200 dark:text-black"
          >
            {scriptLoading && <Spinner />}
            {scriptLoading ? "Writing script…" : "Generate Script"}
          </button>
          <button
            type="button"
            onClick={() => setShowGuidance((v) => !v)}
            className="flex-shrink-0 text-xs font-semibold text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            {showGuidance ? "Hide guidance" : "Add guidance"}
          </button>
        </div>
        {showGuidance && (
          <textarea
            value={topicSteer}
            onChange={(e) => setTopicSteer(e.target.value)}
            disabled={scriptLoading}
            rows={4}
            autoFocus
            placeholder="What should this script be about? Leave blank for the model's choice."
            className="w-full flex-1 resize-none rounded-xl border border-black/10 bg-white p-2 text-sm text-black disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        )}
        {scriptError && (
          <p className="text-sm text-red-600 dark:text-red-400">{scriptError}</p>
        )}

        {scriptInfo && (
          <>
            <div className="flex flex-col gap-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold text-black dark:text-white">
                    {scriptInfo.title} — hook {scriptInfo.hook_score}/10,{" "}
                    {scriptInfo.word_count} words, ~{scriptInfo.estimated_duration_seconds}s
                  </p>
                  {(scriptInfo.hook_line ?? scriptInfo.opening_line) && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {activeProfileId === "heartlines" ? "Opening line" : "Hook line"}:{" "}
                      <span className="font-semibold text-black dark:text-white">
                        {scriptInfo.hook_line ?? scriptInfo.opening_line}
                      </span>
                    </p>
                  )}
                  {scriptInfo.thumbnail_caption && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      Thumbnail caption:{" "}
                      <span className="font-semibold text-black dark:text-white">
                        {scriptInfo.thumbnail_caption}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCleanView((v) => !v)}
                  className="flex-shrink-0 text-xs font-semibold text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-black dark:hover:text-white"
                >
                  {cleanView ? "Show tags" : "Clean copy"}
                </button>
              </div>
              {scriptInfo.insight && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  <span className="font-semibold uppercase tracking-wide">Insight: </span>
                  {scriptInfo.insight}
                </div>
              )}
              {cleanView ? (
                <p className="whitespace-pre-line">
                  {scriptInfo.lines.map(stripScriptTags).join("\n")}
                </p>
              ) : (
                <ol className="list-decimal space-y-0.5 pl-4">
                  {scriptInfo.lines.map((line, i) => (
                    <li key={i}>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        ({scriptLineRoles[i]})
                      </span>{" "}
                      {line}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <button
              type="button"
              onClick={generateImagePrompts}
              disabled={scriptLoading || imagePromptsLoading}
              className="flex items-center justify-center gap-2 self-start rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-200 dark:text-black"
            >
              {imagePromptsLoading && <Spinner />}
              {imagePromptsLoading ? "Writing image prompts…" : "Write Image Prompts"}
            </button>
            {imagePromptsError && (
              <p className="text-sm text-red-600 dark:text-red-400">{imagePromptsError}</p>
            )}
            {translateError && (
              <p className="text-sm text-red-600 dark:text-red-400">{translateError}</p>
            )}
            {translatedScript && (
              <div className="flex flex-col gap-1 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <p className="font-semibold text-black dark:text-white">
                  {translatedScript.title} — hook {translatedScript.hook_score}/10,{" "}
                  {translatedScript.word_count} words, ~
                  {translatedScript.estimated_duration_seconds}s
                </p>
                <ol className="list-decimal space-y-0.5 pl-4">
                  {translatedScript.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot, i) => (
          <div
            key={slot.id}
            className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
          >
            {slot.status === "done" && slot.imageUrl ? (
              <div>
                <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                  <Image
                    src={slot.imageUrl}
                    alt={`Prompt ${i + 1} result`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    disabled={slots.length <= MIN_SLOTS}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 bg-zinc-100 px-2.5 py-2 dark:bg-zinc-900">
                  <p className="line-clamp-2 flex-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {slot.prompt}
                  </p>
                  <DownloadImageButton
                    url={slot.imageUrl}
                    filename={`abacus-${slot.id}.jpg`}
                    className="flex-shrink-0 text-xs font-semibold text-black underline decoration-dotted underline-offset-2 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3" style={{ aspectRatio: "9 / 16" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black dark:text-white">
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
                  disabled={slot.status === "generating"}
                  placeholder="Full, self-contained image-generation prompt…"
                  className="w-full flex-1 resize-none bg-transparent p-0 text-xs text-black outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:text-white dark:placeholder:text-zinc-500"
                />

                {slot.status === "generating" && (
                  <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Spinner />
                    Generating…
                  </p>
                )}

                {slot.status === "error" && (
                  <p className="text-xs text-red-600 dark:text-red-400">{slot.error}</p>
                )}
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
          className="flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {generating && <Spinner className="border-white dark:border-black" />}
          {generating ? "Generating…" : "Generate All"}
        </button>

        {finishedItems.length > 0 && (
          <DownloadPack
            items={finishedItems}
            zipFilename={`${slugify(scriptInfo?.title ?? "abacus-images")}.zip`}
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

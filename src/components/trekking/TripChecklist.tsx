"use client";

import { useMemo, useSyncExternalStore } from "react";
import { filterChecklist, kindsForJourney } from "@/data/checklist";

/*
 * Where the ticks are kept: localStorage, read through useSyncExternalStore,
 * so the server and the hydrating page both draw an unticked list and React
 * swaps in the saved one straight after. Storage can throw outright in a
 * locked-down browser, so every access is guarded and the list falls back to
 * memory — it still works for the session, it just isn't kept.
 */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // The same list ticked in another tab.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTicks(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeTicks(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  listeners.forEach((l) => l());
}

/**
 * An optional checklist, filtered to the journey it appears on.
 *
 * Ticks live in the visitor's own browser and nowhere else. No account, no
 * sign-up, nothing sent anywhere — a packing list is not a reason to ask
 * someone for an email address.
 */
export default function TripChecklist({
  style,
  maxAltitudeM,
  journeyName,
}: {
  style: string;
  maxAltitudeM?: number;
  journeyName: string;
}) {
  const categories = useMemo(
    () => filterChecklist(kindsForJourney({ style, maxAltitudeM })),
    [style, maxAltitudeM],
  );
  const storageKey = `logosa:checklist:${journeyName}`;

  const saved = useSyncExternalStore(subscribe, () => readTicks(storageKey), () => null);
  const done = useMemo<Record<string, boolean>>(() => {
    try {
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
    } catch {
      return {}; // a corrupted entry is an unticked list, not a broken page
    }
  }, [saved]);

  const tick = (id: string, on: boolean) =>
    writeTicks(storageKey, JSON.stringify({ ...done, [id]: on }));

  const total = categories.reduce((n, c) => n + c.items.length, 0);
  const ticked = Object.values(done).filter(Boolean).length;

  return (
    <section aria-labelledby="checklist-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h2 id="checklist-heading" className="text-display-s text-ink">
            Before you go
          </h2>
          <p className="mt-3 max-w-[46ch] text-body text-ink-soft">
            Filtered to this journey. Ticks are saved in this browser only.
          </p>
        </div>
        <p className="numeral text-title text-ink-faint" aria-live="polite">
          {ticked} / {total}
        </p>
      </div>

      <div className="mt-10 grid-editorial gap-y-10">
        {categories.map((c) => (
          <div key={c.id} className="col-span-12 md:col-span-4">
            <h3 className="label border-b border-rule pb-3 text-ink">{c.title}</h3>
            <p className="label-slim mt-3">{c.kicker}</p>
            <ul className="mt-5 space-y-3.5">
              {c.items.map((item) => {
                const checked = Boolean(done[item.id]);
                return (
                  <li key={item.id}>
                    <label className="group flex cursor-pointer items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => tick(item.id, e.target.checked)}
                        className="peer sr-only"
                      />
                      {/* A drawn box, matching the woven diamond used elsewhere */}
                      <span
                        aria-hidden="true"
                        className="mt-[0.28em] grid h-[0.95rem] w-[0.95rem] shrink-0 place-items-center border border-ink transition-colors peer-checked:bg-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                      >
                        <span
                          className={
                            checked
                              ? "block h-[0.36rem] w-[0.36rem] rotate-45 bg-ink"
                              : "hidden"
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={
                            checked
                              ? "text-body text-ink-faint line-through"
                              : "text-body text-ink"
                          }
                        >
                          {item.label}
                        </span>
                        {item.note && (
                          <span className="mt-1 block text-small text-ink-faint">
                            {item.note}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

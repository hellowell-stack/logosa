"use client";

import { useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * MOTION — one place where GSAP is registered and configured.
 *
 * The motion system has four levels and this module only provides the plumbing
 * for them. What it enforces globally is the one rule that matters: if the
 * visitor has asked for reduced motion, every scroll-driven timeline collapses
 * to its end state rather than running. Nothing on this site is animation-only;
 * every timeline animates *toward* the readable layout, so freezing them at the
 * end is always the correct, complete result.
 */

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  // Position-fixed elements are re-measured on resize only, not on every
  // scroll frame — this is the main source of scroll jank on iOS.
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
  registered = true;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Coarse pointer and small viewport — used to downgrade expensive sequences. */
export function isHandheld(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 860px), (pointer: coarse)").matches;
}

/*
 * The same two facts, for deciding what to render.
 *
 * Read through useSyncExternalStore so the server render and the hydrating
 * client agree — both start from false — and React swaps in the real value
 * itself once hydration is done. Each is read once per page load and then
 * held: a sequence that has downgraded itself for a phone stays downgraded,
 * rather than swapping models when a window is resized across the line.
 */
const once = (read: () => boolean) => {
  let value: boolean | undefined;
  return () => (value ??= read());
};
const reducedOnce = once(prefersReducedMotion);
const handheldOnce = once(isHandheld);
const neverChanges = () => () => {};
const onServer = () => false;

export const useReducedMotion = () => useSyncExternalStore(neverChanges, reducedOnce, onServer);
export const useHandheld = () => useSyncExternalStore(neverChanges, handheldOnce, onServer);

export { gsap, ScrollTrigger };

// File: p2p-kids-marketplace/src/services/qaScrollRegistry.ts
// DEV-TASK-84 (2026-09-01) — __DEV__/staging-only registry + helpers that let
// the QA deep link `p2pkidsmarketplace://qa-scroll-to?testID=<id>` program-
// matically scroll the target element into view and report its fresh viewport
// coordinates, in ONE call.
//
// QA Task 17 F-2 / F-Z04: bottom-anchored buttons are unreliable to tap from
// AX-tree coordinates (the floating tab pill occludes them / the timeline
// ScrollView snaps to only ~2 positions), forcing a swipe-then-relist-then-OCR
// cycle per occurrence. This registry lets the currently-open screen register
// a `scrollToTestID` implementation (it knows its ScrollView + the refs of its
// elements), so the deep link can scroll the target into the visible band and
// return fresh viewport coords — killing the manual-swipe cycle at the root.
//
// SECURITY: nothing here is reachable in production. Callers (screens) only
// register in dev/staging builds, and the only consumer
// (QaScrollToDeepLinkHandler) is gated to dev/staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers the listener, so the deep link is inert there.

import { Dimensions, type ScrollView, type View } from 'react-native';
import type { RefObject } from 'react';

/** Viewport (window) coordinates of a scrolled-into-view element. */
export type QaScrollCoords = { x: number; y: number };

/**
 * Outcome of a scroll attempt.
 * - `ok`          — the element was scrolled AND its coords are inside the viewport.
 * - `out_of_view` — the scroll was issued but the element is still outside the
 *                   viewport. The coords are reported for diagnosis only and are
 *                   NOT tap-usable.
 *
 * FIX-Task-15 item 2 (2026-09-10): before this, a scroll that silently did
 * nothing (Android) still resolved with plausible-looking coordinates and was
 * logged as success — a false positive QA had to disprove with a cross-platform
 * control (QA playbook R94).
 */
export type QaScrollResult =
  | { status: 'ok'; coords: QaScrollCoords }
  | { status: 'out_of_view'; coords: QaScrollCoords }
  | { status: 'measure_failed' };

/**
 * Screen-provided scroll implementation: given a target testID, scroll it into
 * view and resolve with the outcome (or `null` when the element / scroll
 * container isn't mounted — the caller reports that as NOT_FOUND).
 */
export type QaScrollToFn = (testID: string) => Promise<QaScrollResult | null>;

// FIX-Task-15 item 2: bounded settle window after issuing the (non-animated)
// scroll. Platforms apply the new offset over the next frame(s), so the element
// is re-measured a few times before declaring it out of view.
const SCROLL_SETTLE_ATTEMPTS = 6;
const SCROLL_SETTLE_INTERVAL_MS = 32;

/** `measureLayout`'s `relativeToNativeComponentRef` argument type. */
type Measurable = Parameters<View['measureLayout']>[0];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

let scrollFn: QaScrollToFn | null = null;

/**
 * Registers (or clears) the active screen's scroll-to-testID handler. Returns
 * an unregister function. Exactly one screen should hold the registration at a
 * time — screens register on mount and unregister on unmount.
 */
export function registerQaScrollToHandler(fn: QaScrollToFn | null): () => void {
  scrollFn = fn;
  return () => {
    if (scrollFn === fn) {
      scrollFn = null;
    }
  };
}

/**
 * Invokes the registered screen's scroll-to-testID handler.
 * @returns handled=true if a handler was registered, plus the scroll outcome
 *          (null when the element isn't found / the handler errored).
 */
export async function requestQaScrollTo(
  testID: string
): Promise<{ handled: boolean; result: QaScrollResult | null }> {
  if (!scrollFn) {
    return { handled: false, result: null };
  }
  try {
    const result = await scrollFn(testID);
    return { handled: true, result };
  } catch {
    return { handled: true, result: null };
  }
}

/**
 * Reusable helper (the HelpScreen.tsx `measureLayout` pattern, generalized):
 * scrolls a child element (by ref) into view within a ScrollView (by ref) and
 * resolves with the child's fresh viewport (window) coordinates.
 *
 * `headerOffset` gives a little breathing room above the target so it clears
 * headers/pills after the scroll lands.
 */
export function scrollChildIntoView(
  scrollRef: RefObject<ScrollView | null>,
  childRef: RefObject<View | null>,
  headerOffset = 80
): Promise<QaScrollResult | null> {
  return new Promise((resolve) => {
    const scrollView = scrollRef.current;
    const child = childRef.current;
    if (!scrollView || !child) {
      resolve(null);
      return;
    }

    // FIX-Task-15 item 2b (2026-09-10): measure through the COMPONENT REFS, never
    // `UIManager.measureInWindow(findNodeHandle(...))`. On the Android dev build
    // the tag-based API failed ("measure cannot find view with tag #<n>") and
    // handed back NaN, which the old code happily formatted into a RESULT line.
    // `getNativeScrollRef()` is ScrollView's supported accessor for the host node
    // `measureLayout` needs — it reports the child's offset inside the scroll
    // CONTENT, which is exactly what `scrollTo` consumes.
    const relativeTo = (scrollView.getNativeScrollRef() ?? scrollView) as Measurable;

    child.measureLayout(
      relativeTo,
      (_x, contentY) => {
        if (!isFiniteNumber(contentY)) {
          resolve({ status: 'measure_failed' });
          return;
        }

        // `animated: false` — an ANIMATED scroll measured one frame later read the
        // PRE-scroll position (it worked on iOS, where the animation lands fast,
        // and did nothing on Android).
        scrollView.scrollTo({ y: Math.max(0, contentY - headerOffset), animated: false });

        // A coordinate is only usable if it lands inside the window.
        const windowHeight = Dimensions.get('window').height;
        let attempt = 0;
        let lastCoords: QaScrollCoords | null = null;

        const settle = () => {
          child.measureInWindow((px, py, _pw, ph) => {
            const hasCoords = isFiniteNumber(px) && isFiniteNumber(py) && isFiniteNumber(ph);
            lastCoords = hasCoords ? { x: Math.round(px), y: Math.round(py) } : null;

            const centreY = hasCoords ? py + ph / 2 : Number.NaN;
            if (Number.isFinite(centreY) && centreY > 0 && centreY < windowHeight) {
              resolve({ status: 'ok', coords: lastCoords as QaScrollCoords });
              return;
            }

            attempt += 1;
            if (attempt < SCROLL_SETTLE_ATTEMPTS) {
              // Bounded re-measure: platforms apply the offset over the next frame(s).
              setTimeout(settle, SCROLL_SETTLE_INTERVAL_MS);
              return;
            }

            // Never report a non-finite or off-screen coordinate as a usable result.
            resolve(
              lastCoords
                ? { status: 'out_of_view', coords: lastCoords }
                : { status: 'measure_failed' }
            );
          });
        };

        settle();
      },
      () => resolve(null)
    );
  });
}

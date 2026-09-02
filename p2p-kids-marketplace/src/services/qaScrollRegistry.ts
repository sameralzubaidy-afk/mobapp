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

import { findNodeHandle, UIManager, type ScrollView, type View } from 'react-native';
import type { RefObject } from 'react';

/** Viewport (window) coordinates of a scrolled-into-view element. */
export type QaScrollCoords = { x: number; y: number };

/**
 * Screen-provided scroll implementation: given a target testID, scroll it into
 * view and resolve with its fresh viewport coords (or null if not found / the
 * scroll container isn't mounted).
 */
export type QaScrollToFn = (testID: string) => Promise<QaScrollCoords | null>;

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
 * @returns handled=true if a handler was registered, plus the element's fresh
 *          viewport coords after scrolling (null when not found / handler error).
 */
export async function requestQaScrollTo(
  testID: string
): Promise<{ handled: boolean; coords: QaScrollCoords | null }> {
  if (!scrollFn) {
    return { handled: false, coords: null };
  }
  try {
    const coords = await scrollFn(testID);
    return { handled: true, coords };
  } catch {
    return { handled: true, coords: null };
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
): Promise<QaScrollCoords | null> {
  return new Promise((resolve) => {
    const scrollNode = findNodeHandle(scrollRef.current);
    const childNode = findNodeHandle(childRef.current);
    if (!scrollNode || !childNode) {
      resolve(null);
      return;
    }

    // measureLayout(child, relativeTo) → x,y are relative to the ScrollView's
    // CONTENT origin (unscrolled), exactly what scrollTo needs.
    UIManager.measureLayout(
      childNode,
      scrollNode,
      () => resolve(null),
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - headerOffset), animated: true });
        // Wait a frame for the scroll to land, then report window coords.
        requestAnimationFrame(() => {
          UIManager.measureInWindow(childNode, (px, py) => {
            resolve({ x: Math.round(px), y: Math.round(py) });
          });
        });
      }
    );
  });
}

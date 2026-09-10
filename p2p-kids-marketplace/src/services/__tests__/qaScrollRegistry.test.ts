// File: src/services/__tests__/qaScrollRegistry.test.ts
// DEV-TASK-84 item 3 — unit tests for the qa-scroll-to registry + the
// `scrollChildIntoView` helper (the measureLayout → scrollTo → measureInWindow
// flow that powers `p2pkidsmarketplace://qa-scroll-to?testID=<id>`).
//
// Verifies:
//   - requestQaScrollTo resolves the registered handler's coords, and reports
//     handled=false when no screen has registered,
//   - register/unregister lifecycle clears the slot,
//   - scrollChildIntoView scrolls to (contentY - headerOffset) and resolves
//     with the fresh viewport (window) coords,
//   - scrollChildIntoView resolves null when either ref is unmounted.

import {
  registerQaScrollToHandler,
  requestQaScrollTo,
  scrollChildIntoView,
} from '../qaScrollRegistry';

// qaScrollRegistry.ts no longer touches `UIManager`/`findNodeHandle` (FIX-Task-15
// item 2b — the tag-based measure APIs returned NaN on the Android dev build). It
// now measures through the COMPONENT REFS, so the tests below pass plain objects
// shaped like ScrollView/View instances; only `Dimensions` needs stubbing here.
jest.mock('react-native', () => ({
  Dimensions: { get: jest.fn(() => ({ width: 400, height: 800 })) },
}));

describe('requestQaScrollTo (registry)', () => {
  afterEach(() => {
    registerQaScrollToHandler(null);
    jest.clearAllMocks();
  });

  it('reports handled=false when no screen has registered a handler', async () => {
    const result = await requestQaScrollTo('approve-cancel-request-button');
    expect(result).toEqual({ handled: false, result: null });
  });

  it('resolves the registered handler result', async () => {
    registerQaScrollToHandler(async () => ({ status: 'ok', coords: { x: 220, y: 500 } }));
    const response = await requestQaScrollTo('approve-cancel-request-button');
    expect(response).toEqual({ handled: true, result: { status: 'ok', coords: { x: 220, y: 500 } } });
  });

  it('reports result=null when the handler cannot find the element', async () => {
    registerQaScrollToHandler(async () => null);
    const response = await requestQaScrollTo('no-such-button');
    expect(response).toEqual({ handled: true, result: null });
  });

  it('reports result=null when the handler throws (never propagates)', async () => {
    registerQaScrollToHandler(async () => {
      throw new Error('boom');
    });
    const response = await requestQaScrollTo('boom-button');
    expect(response).toEqual({ handled: true, result: null });
  });

  it('unregisters the handler (returns the slot to idle)', async () => {
    const unregister = registerQaScrollToHandler(async () => ({
      status: 'ok',
      coords: { x: 1, y: 2 },
    }));
    unregister();
    const response = await requestQaScrollTo('approve-cancel-request-button');
    expect(response.handled).toBe(false);
  });
});

describe('scrollChildIntoView (helper)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // FIX-Task-15 item 2b: the helper measures through the component refs, so a ref
  // is any object shaped like a ScrollView/View instance. The stubbed window is
  // 0..800 tall (see the `Dimensions` mock above).
  const makeRefs = ({
    contentY = 500,
    childY = 300,
    childH = 40,
  }: { contentY?: number; childY?: number; childH?: number } = {}) => {
    const scrollTo = jest.fn();
    const scrollView = {
      scrollTo,
      getNativeScrollRef: jest.fn(() => ({ nativeScrollHost: true })),
    };
    const child = {
      measureLayout: jest.fn((_rel: unknown, onSuccess: any) =>
        onSuccess(0, contentY, 100, childH)
      ),
      measureInWindow: jest.fn((cb: any) => cb(220, childY, 100, childH)),
    };
    return {
      scrollTo,
      scrollView,
      child,
      scrollRef: { current: scrollView },
      childRef: { current: child },
    };
  };

  it('scrolls the child into view (non-animated) and resolves with fresh window coords', async () => {
    const { scrollTo, scrollRef, childRef } = makeRefs({ contentY: 500, childY: 300 });

    const result = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    // FIX-Task-15 item 2: NOT animated, so the offset is applied immediately and
    // the measurement cannot read the pre-scroll position (the Android no-op).
    expect(scrollTo).toHaveBeenCalledWith({ y: 420, animated: false });
    expect(result).toEqual({ status: 'ok', coords: { x: 220, y: 300 } });
  });

  it('clamps negative scroll targets to 0', async () => {
    const { scrollTo, scrollRef, childRef } = makeRefs({ contentY: 10, childY: 300 });

    await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });

  it('reports out_of_view (never a usable coord) when the element stays outside the window', async () => {
    // Regression guard for the Android no-op scroll QA proved on 2026-09-10: the
    // ScrollView never moved and the old code still logged `RESULT id 16 1214` as
    // success — a y far below the 825dp viewport / the 800dp stubbed window.
    const { scrollRef, childRef } = makeRefs({ contentY: 1500, childY: 1214 });

    const result = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(result).toEqual({ status: 'out_of_view', coords: { x: 220, y: 1214 } });
  });

  it('reports measure_failed (never NaN coords) when the native measure is non-finite', async () => {
    // The Android dev build handed back NaN from the tag-based API and the tool
    // formatted it into `RESULT id OUT_OF_VIEW NaN NaN`.
    const { child, scrollRef, childRef } = makeRefs();
    (child.measureInWindow as jest.Mock).mockImplementation((cb: any) =>
      cb(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
    );

    const result = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(result).toEqual({ status: 'measure_failed' });
  });

  it('reports measure_failed when the content offset itself is non-finite', async () => {
    const { child, scrollRef, childRef } = makeRefs();
    (child.measureLayout as jest.Mock).mockImplementation((_rel: unknown, onSuccess: any) =>
      onSuccess(0, Number.NaN, 100, 40)
    );

    const result = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(result).toEqual({ status: 'measure_failed' });
  });

  it('resolves null when the element cannot be measured relative to the scroll view', async () => {
    const { child, scrollRef, childRef } = makeRefs();
    (child.measureLayout as jest.Mock).mockImplementation(
      (_rel: unknown, _onSuccess: any, onFail: any) => onFail()
    );

    const result = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(result).toBeNull();
  });

  it('resolves null when the scroll ref is unmounted', async () => {
    const result = await scrollChildIntoView({ current: null } as never, { current: {} } as never);
    expect(result).toBeNull();
  });

  it('resolves null when the child ref is unmounted', async () => {
    const result = await scrollChildIntoView(
      { current: { scrollTo: jest.fn() } } as never,
      {
        current: null,
      } as never
    );
    expect(result).toBeNull();
  });
});

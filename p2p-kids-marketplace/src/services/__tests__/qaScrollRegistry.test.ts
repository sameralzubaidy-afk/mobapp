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

import { UIManager } from 'react-native';
import {
  registerQaScrollToHandler,
  requestQaScrollTo,
  scrollChildIntoView,
} from '../qaScrollRegistry';

// qaScrollRegistry.ts imports only `findNodeHandle` + `UIManager` at runtime
// (ScrollView/View are type-only imports, erased at compile time), so a minimal
// fake is sufficient — a full jest.requireActual('react-native') crashes the
// TurboModule registry in this jest setup.
jest.mock('react-native', () => ({
  findNodeHandle: jest.fn((ref: unknown) => (ref ? 1 : null)),
  UIManager: {
    measureLayout: jest.fn(),
    measureInWindow: jest.fn(),
  },
}));

// jsdom may not provide requestAnimationFrame; stub it to run synchronously.
const originalRaf = global.requestAnimationFrame;
beforeAll(() => {
  global.requestAnimationFrame = ((cb: () => void) => {
    cb();
    return 0;
  }) as typeof requestAnimationFrame;
});
afterAll(() => {
  global.requestAnimationFrame = originalRaf;
});

const mockMeasureLayout = UIManager.measureLayout as jest.Mock;
const mockMeasureInWindow = UIManager.measureInWindow as jest.Mock;

describe('requestQaScrollTo (registry)', () => {
  afterEach(() => {
    registerQaScrollToHandler(null);
    jest.clearAllMocks();
  });

  it('reports handled=false when no screen has registered a handler', async () => {
    const result = await requestQaScrollTo('approve-cancel-request-button');
    expect(result).toEqual({ handled: false, coords: null });
  });

  it('resolves the registered handler result', async () => {
    registerQaScrollToHandler(async () => ({ x: 220, y: 500 }));
    const result = await requestQaScrollTo('approve-cancel-request-button');
    expect(result).toEqual({ handled: true, coords: { x: 220, y: 500 } });
  });

  it('reports coords=null when the handler cannot find the element', async () => {
    registerQaScrollToHandler(async () => null);
    const result = await requestQaScrollTo('no-such-button');
    expect(result).toEqual({ handled: true, coords: null });
  });

  it('reports coords=null when the handler throws (never propagates)', async () => {
    registerQaScrollToHandler(async () => {
      throw new Error('boom');
    });
    const result = await requestQaScrollTo('boom-button');
    expect(result).toEqual({ handled: true, coords: null });
  });

  it('unregisters the handler (returns the slot to idle)', async () => {
    const unregister = registerQaScrollToHandler(async () => ({ x: 1, y: 2 }));
    unregister();
    const result = await requestQaScrollTo('approve-cancel-request-button');
    expect(result.handled).toBe(false);
  });
});

describe('scrollChildIntoView (helper)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scrolls the child into view and resolves with fresh viewport coords', async () => {
    const scrollTo = jest.fn();
    const scrollRef = { current: { scrollTo } };
    const childRef = { current: {} };

    mockMeasureLayout.mockImplementation((_child, _rel, _onErr, onSuccess) => {
      // content-relative y = 500 (unscrolled origin)
      onSuccess(0, 500, 100, 40);
    });
    mockMeasureInWindow.mockImplementation((_node, cb) => {
      cb(220, 300, 100, 40);
    });

    const coords = await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(scrollTo).toHaveBeenCalledWith({ y: 420, animated: true });
    expect(coords).toEqual({ x: 220, y: 300 });
  });

  it('clamps negative scroll targets to 0', async () => {
    const scrollTo = jest.fn();
    const scrollRef = { current: { scrollTo } };
    const childRef = { current: {} };

    mockMeasureLayout.mockImplementation((_child, _rel, _onErr, onSuccess) => {
      onSuccess(0, 10, 100, 40); // y=10, headerOffset=80 → negative
    });
    mockMeasureInWindow.mockImplementation((_node, cb) => {
      cb(220, 300, 100, 40);
    });

    await scrollChildIntoView(scrollRef as never, childRef as never, 80);

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('resolves null when the scroll ref is unmounted', async () => {
    const coords = await scrollChildIntoView({ current: null } as never, { current: {} } as never);
    expect(coords).toBeNull();
  });

  it('resolves null when the child ref is unmounted', async () => {
    const coords = await scrollChildIntoView(
      { current: { scrollTo: jest.fn() } } as never,
      {
        current: null,
      } as never
    );
    expect(coords).toBeNull();
  });
});

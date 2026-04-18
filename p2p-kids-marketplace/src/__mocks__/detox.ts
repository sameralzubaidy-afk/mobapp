type Selector = {
  strategy: 'text' | 'id';
  value: unknown;
};

type MockElement = {
  tap: () => Promise<void>;
  typeText: (_value: string) => Promise<void>;
};

const noopAsync = async (): Promise<void> => {};

const makeElement = (): MockElement => ({
  tap: noopAsync,
  typeText: async (_value: string) => {},
});

export const by = {
  text: (value: unknown): Selector => ({ strategy: 'text', value }),
  id: (value: unknown): Selector => ({ strategy: 'id', value }),
};

export const element = (_selector: Selector): MockElement => makeElement();

export const device = {
  launchApp: async (_opts?: unknown): Promise<void> => {},
  reloadReactNative: async (): Promise<void> => {},
  openURL: async (_opts: { url: string }): Promise<void> => {},
};

export const waitFor = (_target: unknown) => ({
  toBeVisible: () => ({
    withTimeout: async (_timeoutMs: number): Promise<void> => {},
  }),
});

export const expect = (_target: unknown) => ({
  toBeVisible: async (): Promise<void> => {},
});

type DetoxLike = {
  by: any;
  element: any;
  expect: any;
  device: any;
  waitFor: any;
};

const loadDetox = (): DetoxLike => {
  try {
    return require('detox') as DetoxLike;
  } catch {
    return require('../__mocks__/detox') as DetoxLike;
  }
};

const detoxLike = loadDetox();

export const by = detoxLike.by;
export const element = detoxLike.element;
export const expect = detoxLike.expect;
export const device = detoxLike.device;
export const waitFor = detoxLike.waitFor;

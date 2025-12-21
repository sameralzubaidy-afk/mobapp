Dev-only autofill helpers
=========================

What: A small dev-only seed and helpers to speed manual testing and automated E2E tests.

Files added:
- `p2p-kids-marketplace/src/test-data/test-users.json` — 5 sample test accounts
- `p2p-kids-marketplace/src/test-data/index.ts` — helpers: `getAllTestUsers`, `getRandomTestUser`, `getTestUserById`, etc.

Usage (manual):

1. In your screen code (guarded by `__DEV__`) import the helper:

```ts
import { getAllTestUsers, getRandomTestUser } from '@/test-data';
// or: import from 'src/test-data'
if (__DEV__) {
  const user = getRandomTestUser();
  // populate your form with `user` values
}
```

2. Dev UI: The Signup and Login screens include dev-only autofill buttons:

- On `Signup` there is a "Fill Random" button and quick buttons for the first 3 test users.
- On `Login` there's a button "Open Signup (Fill Random)" which navigates to the Signup screen and prefills the form.

Buttons are only visible when `__DEV__` is true and include `testID` attributes for E2E (`dev-fill-random-user`, `dev-fill-<id>`, `dev-open-signup-with-user`).

Notes:
- This module is strictly dev-only. Guard UI or business usage behind `__DEV__` or a dev feature flag.
- Passwords are placeholder values for local testing only and must never be used in production.

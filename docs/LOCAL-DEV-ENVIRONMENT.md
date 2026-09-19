# Local Dev Environment — single-Metro cold-connect procedure

> **Owner:** Samer · **Audience:** anyone starting the app locally (incl. the QA
> Test Agent) · **Added:** FIX-Task-17 item 9 (2026-09-11, QA finding F9).

---

## 1. The rule (one line)

**For a single-platform session, exactly ONE Metro instance may run, and it must own `:8081`.**
Run `npm run metro:kill` **before** you start a session, and start Metro with
`npm run start:single`.

> **Scope:** this rule exists to stop *stray / accidental* duplicate Metros (see §2).
> The deliberate two-instance case — iOS `:8081` **and** Android `:8082` running at
> the same time via `npm run dev:ios` + `npm run dev:android` — is supported and
> documented in **§7**.

---

## 2. Why this matters

`expo start` **silently falls forward to the next free port.** So if a stray
Metro is still holding `:8081` — e.g. one you left running in another terminal,
or one the QA harness left behind — the new server quietly binds `:8082` instead
of failing.

The dev client then has **two candidate servers** and picks one at connect time.
On Android that produced:

- **~90 s of `Bundling …%`** before the app appeared (`51 % → 55 % → 99 %`),
- then a **blank first frame**, then the rendered app.

Measured 2026-09-11 (QA dispatch Stage 2, finding F9). This is **pure harness
cost** — the app itself is fine on a warm launch. But it burns QA budget and
makes a healthy build look broken, and a half-loaded first frame can make a
screen look buggy when it isn't.

**Live confirmation (same day):** running the cleanup script found *two* stray
Metro instances listening — `:8081` and `:8082` — exactly the state F9 described.

---

## 3. Before every session (do this)

```bash
cd p2p-kids-marketplace

npm run metro:kill      # kills anything listening on 8081/8082/8083
npm run start:single    # then start Metro — guaranteed to bind :8081
```

`npm run metro:kill` prints what it killed, e.g.

```
Metro cleanup: killing listener(s) on :8081 -> 27285
Metro cleanup: killing listener(s) on :8082 -> 30571
Metro cleanup: done — :8081 is free for a single Metro instance.
```

If it prints `no listener on 8081 8082 8083 — nothing to kill.` you are already
in the clean state.

### Shortcuts that already do both steps

| Command | What it does |
|---|---|
| `npm run start:single` | kill stray Metro → `expo start` (binds `:8081`) |
| `npm run start:fresh` | kill stray Metro → `expo start --clear` |
| `npm run ios:fresh` | kill stray Metro → build & run the iOS simulator |
| `npm run android:fresh` | kill stray Metro → `expo run:android --clear` |
| `npm run metro:kill` | kill only (no start) — use before any manual start |

---

## 4. Verifying you really have one instance

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN    # should print exactly one process
lsof -nP -iTCP:8082 -sTCP:LISTEN    # should print NOTHING
```

If `:8082` has a listener **and you did not start a dual session (§7)**, you have
the duplicate-Metro condition — run `npm run metro:kill` and restart.

The Metro output line `Metro waiting on exp://…:8081` (not `:8082`) is the
quick visual check.

---

## 5. When Metro is already wedged

A wedged Metro ignores `SIGTERM`, which is exactly how you end up with the
duplicate. `npm run metro:kill` handles that: it sends `SIGTERM` first, waits 1 s,
then `SIGKILL`s anything still holding a port. It only ever touches processes
**listening** on the Metro ports — it does not touch your shell, git, or any
other dev process.

If you need a different port list (e.g. `:8082` is used by another project on
your machine):

```bash
METRO_PORTS="8081" bash scripts/kill-stray-metro.sh
```

---

## 6. What NOT to do

- **Don't** leave a Metro running in a second terminal "just in case" — that is
  the duplicate.
- **Don't** start a *second Metro for the same platform* from another shell — run
  `expo start` with no `--port` and the second one silently lands on `:8082`
  instead of failing. (Two *deliberate* instances, one per platform, are fine — §7.)
- **Don't** launch the dev client while a *stale* `:8082` holds a listener — it may
  pick that server. In the dual session of §7 each client is pinned to its own
  port, so this hazard does not apply.
- **Don't** work around a slow cold connect by wiping the app data; kill the
  stray Metro instead.

---

## 7. Dual session — iOS and Android at the same time

Supported by design. Each script owns one port and hands its dev client an
explicit server URL, so the two never compete:

| Command | Metro | Target | How that app finds its Metro |
|---|---|---|---|
| `npm run dev:ios` | `:8081` | iOS Simulator | Expo CLI opens the dev client with `…?url=http://<lan-ip>:8081` |
| `npm run dev:android` | `:8082` | Android Emulator | `adb reverse tcp:8082` + deep link `…?url=http://localhost:8082` |

Run each in its **own terminal**. Neither script touches the other's port —
`dev-ios.sh` only clears `:8081`, `dev-android.sh` only clears `:8082`. Because
each dev client is given one explicit URL, the F9 ambiguity in §2 cannot occur.

### Cache isolation (required for this to be clean)

Both scripts start Metro with `EXPO_METRO_CACHE_TAG=ios|android`, which
`metro.config.js` turns into a per-instance cache root:

- iOS → `$TMPDIR/metro-cache-ios`
- Android → `$TMPDIR/metro-cache-android`

Without this, both instances share Expo's single `$TMPDIR/metro-cache`
(`@expo/metro-config` overrides Metro's own stores with that one root), and
`--clear` on the second instance wipes the cache the first is actively using —
a cold re-bundle mid-session.

### Verify both are up

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN    # iOS Metro
lsof -nP -iTCP:8082 -sTCP:LISTEN    # Android Metro
```

Both printing a PID is the healthy dual-session state.

### Commands that will KILL a dual session

These are single-session **reset** helpers — they kill listeners on
`8081 8082 8083` and take down the other platform with them:

- `npm run metro:kill`
- `npm run start:single` / `npm run start:fresh`
- `npm run ios:fresh` / `npm run android:fresh`

Do not run them while a dual session is live. To reset only one side:

```bash
METRO_PORTS="8081" bash scripts/kill-stray-metro.sh
```

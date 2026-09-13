# `scripts/qa/` — QA tooling assets

Reusable, platform-side helpers for the QA Test Agent (and manual QA) when
interacting with the iOS Simulator / captured evidence.

## `vision-ocr.swift`

Apple Vision-framework OCR fallback. Reads text out of a screenshot file when
screenshot/`view_image` tooling can't deliver parseable pixels.

```bash
swift scripts/qa/vision-ocr.swift <image-path>
swift scripts/qa/vision-ocr.swift <image-path> --coords
```

- Prints recognized text lines top-to-bottom (sorted by y).
- Exit code 1 + `ERR: ...` if the image can't be loaded or OCR fails.
- `--coords` (FIX-Task-28 item 6, 2026-09-13) appends each line's bounding box as
  **integer top-left PIXELS**:
  `I have read and understand this disclaimer  {x:129,y:2124,w:711,h:35}`.
  Use it to resolve a tap position from a screenshot alone.

**Why `--coords` exists:** the only other coordinate source was a mobile-mcp AX
dump, and an AX dump issued while a deliberately-stalled screen is pending can
kill the dev client (SIGSEGV inside the mobilecli JVMTI agent attach — see
`.github/instructions/QA-Test-Agent.instructions.md`, R87 family). `--coords`
keeps a coordinate source available exactly when the AX tree is unusable.

Note the pixels-vs-points distinction: an Android emulator screenshot is 1:1 with
the mobile-mcp AX tree (verified 1080×2400), but an iOS screenshot is 2x/3x the AX
point space — divide before comparing.

The mobile-app equivalent, with the same flag plus `--region` support, is
`npm run qa:ocr -- --img <path> --coords [--json]`
(`p2p-kids-marketplace/scripts/qa/ocr.mjs`); its `--json` form returns
`[{ text, box: { x, y, w, h } }]`.

**Why it exists:** during Phase 23 QA, `view_image` repeatedly failed to deliver
pixels, so the agent built this one-off Swift script to turn screenshots into
assertable text (plus ImageMagick color/connected-component scans for
non-AX-exposed controls, and tight-crops for regions of interest). It worked
reliably and was rebuilt from scratch more than once — this file makes it
permanent.

**Full context** is in `/memories/repo/qa-test-agent.md` (Phase 25 note).

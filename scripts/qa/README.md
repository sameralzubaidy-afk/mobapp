# `scripts/qa/` — QA tooling assets

Reusable, platform-side helpers for the QA Test Agent (and manual QA) when
interacting with the iOS Simulator / captured evidence.

## `vision-ocr.swift`

Apple Vision-framework OCR fallback. Reads text out of a screenshot file when
screenshot/`view_image` tooling can't deliver parseable pixels.

```bash
swift scripts/qa/vision-ocr.swift <image-path>
```

- Prints recognized text lines top-to-bottom (sorted by y).
- Exit code 1 + `ERR: ...` if the image can't be loaded or OCR fails.

**Why it exists:** during Phase 23 QA, `view_image` repeatedly failed to deliver
pixels, so the agent built this one-off Swift script to turn screenshots into
assertable text (plus ImageMagick color/connected-component scans for
non-AX-exposed controls, and tight-crops for regions of interest). It worked
reliably and was rebuilt from scratch more than once — this file makes it
permanent.

**Full context** is in `/memories/repo/qa-test-agent.md` (Phase 25 note).

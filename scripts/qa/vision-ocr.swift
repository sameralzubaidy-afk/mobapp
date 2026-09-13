// vision-ocr.swift — Reusable QA Vision-OCR helper (macOS)
// ============================================================================
// Built by the QA Test Agent (Phase 23, 2026-08-18) as a fallback verification
// method when standard screenshot / view_image tooling fails to deliver
// parseable visual content. Proven useful more than once — keep it; rebuild it
// only if Apple's Vision framework API changes.
//
// Usage:
//   swift scripts/qa/vision-ocr.swift <image-path> [--coords]
//
// Prints recognized text lines from the image, top-to-bottom (sorted by y).
// Exit code 1 + ERR: message if the image can't be loaded or OCR fails.
//
// --coords (FIX-Task-28 item 6, 2026-09-13): print "<text>  {x:..,y:..,w:..,h:..}"
// with INTEGER TOP-LEFT PIXEL boxes instead of bare text, so a tap position can be
// resolved from a screenshot alone (no mobile-mcp AX dump — which can kill a dev
// client if issued while a deliberately-stalled screen is pending).
//
// Examples:
//   swift scripts/qa/vision-ocr.swift /tmp/f06_toggle_on_1205_results.png
//   swift scripts/qa/vision-ocr.swift /tmp/f06_toggle_on_1205_results.png --coords
//   xcrun simctl io booted screenshot /tmp/s.png && swift scripts/qa/vision-ocr.swift /tmp/s.png
//
// Companion techniques (see /memories/repo/qa-test-agent.md — "Vision-OCR" note):
//   - ImageMagick color / connected-component scans for non-AX controls
//       magick /tmp/s.png -fuzz 8% -fill white +opaque '#5DBB8E' -fill black -opaque '#5DBB8E' txt: | ...
//   - Tight-crop before OCR when a specific region matters
//       magick /tmp/s.png -crop 400x200+100+100 +repage /tmp/crop.png
// ============================================================================

import Foundation
import Vision
import AppKit

// Usage: swift ocr.swift <image-path>
// Prints recognized text lines from the image (top to bottom, roughly by y).

let path = CommandLine.arguments[1]
// FIX-Task-28 item 6: opt-in pixel bounding boxes.
let wantsCoords = CommandLine.arguments.contains("--coords")
guard let img = NSImage(contentsOfFile: path),
      let cgImage = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERR: cannot load image at \(path)")
    exit(1)
}

// Pixel dimensions of the decoded image, used by --coords.
let imgW = CGFloat(cgImage.width)
let imgH = CGFloat(cgImage.height)

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    print("ERR: OCR failed: \(error)")
    exit(1)
}

struct Line {
    let y: CGFloat
    let text: String
    // Vision's normalized rect, bottom-left origin (0-1).
    let box: CGRect
}
var lines: [Line] = []
for obs in request.results ?? [] {
    guard let top = obs.topCandidates(1).first else { continue }
    let y = obs.boundingBox.midY
    lines.append(Line(y: y, text: top.string, box: obs.boundingBox))
}
// Sort top-to-bottom (image coords: higher midY = higher on screen)
lines.sort { $0.y > $1.y }
for l in lines {
    if !wantsCoords {
        print(l.text)
        continue
    }
    // Normalized bottom-left -> integer top-left pixels.
    let x = Int((l.box.minX * imgW).rounded())
    let yy = Int(((1 - (l.box.minY + l.box.height)) * imgH).rounded())
    let w = Int((l.box.width * imgW).rounded())
    let h = Int((l.box.height * imgH).rounded())
    print("\(l.text)  {x:\(x),y:\(yy),w:\(w),h:\(h)}")
}

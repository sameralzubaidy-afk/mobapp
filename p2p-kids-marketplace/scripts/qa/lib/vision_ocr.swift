#!/usr/bin/env swift
//
// vision_ocr.swift — macOS Vision OCR for QA evidence screenshots.
// Committed helper used by `npm run qa:ocr` (scripts/qa/ocr.mjs).
//
// Usage:
//   swift vision_ocr.swift <image-path> [--coords]
//
// Default: prints recognized text lines to stdout, ordered top-to-bottom then
// left-to-right. Exits non-zero with an error on stderr on failure.
//
// --coords (FIX-Task-28 item 6, 2026-09-13): prints ONE JSON OBJECT PER LINE
// instead of plain text:
//   {"text":"...","box":{"minX":..,"minY":..,"width":..,"height":..},
//    "imageWidth":W,"imageHeight":H}
// `box` is Vision's RAW normalized rect (0-1, BOTTOM-LEFT origin). Converting to
// top-left pixels, and adding back any `--region` crop offset, is deliberately
// left to the Node wrapper (scripts/qa/ocr.mjs) so this helper stays a thin shim.
//
import Foundation
import Vision
import AppKit

func fail(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

let cliArgs = CommandLine.arguments
let wantsCoords = cliArgs.contains("--coords")

// Exactly the image path, plus the optional --coords flag.
let positional = cliArgs.dropFirst().filter { !$0.hasPrefix("--") }
guard positional.count == 1 else {
    fail("usage: swift vision_ocr.swift <image-path> [--coords]", 2)
}
let imagePath = positional[0]

guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fail("ERROR: could not load image at \(imagePath)", 3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fail("ERROR: OCR request failed: \(error)", 6)
}

guard let observations = request.results else {
    fail("ERROR: OCR produced no results", 5)
}

// Sort top-to-bottom (descending Y in Vision's normalized, bottom-left origin
// space), then left-to-right within the same visual line.
let sorted = observations.sorted { a, b in
    let aMidY = a.boundingBox.midY
    let bMidY = b.boundingBox.midY
    if abs(aMidY - bMidY) > 0.01 { return aMidY > bMidY }
    return a.boundingBox.minX < b.boundingBox.minX
}

for obs in sorted {
    guard let candidate = obs.topCandidates(1).first else { continue }

    if !wantsCoords {
        print(candidate.string)
        continue
    }

    // FIX-Task-28 item 6: emit the raw normalized box for the Node wrapper.
    let box = obs.boundingBox
    let payload: [String: Any] = [
        "text": candidate.string,
        "box": [
            "minX": box.minX,
            "minY": box.minY,
            "width": box.width,
            "height": box.height,
        ],
        "imageWidth": cgImage.width,
        "imageHeight": cgImage.height,
    ]
    if let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
       let line = String(data: data, encoding: .utf8) {
        print(line)
    }
}

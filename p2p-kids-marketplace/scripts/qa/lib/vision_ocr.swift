#!/usr/bin/env swift
//
// vision_ocr.swift — macOS Vision OCR for QA evidence screenshots.
// Committed helper used by `npm run qa:ocr` (scripts/qa/ocr.mjs).
//
// Usage:
//   swift vision_ocr.swift <image-path>
//
// Prints recognized text lines to stdout, ordered top-to-bottom then
// left-to-right. Exits non-zero with an error on stderr on failure.
//
import Foundation
import Vision
import AppKit

func fail(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

guard CommandLine.arguments.count == 2 else {
    fail("usage: swift vision_ocr.swift <image-path>", 2)
}
let imagePath = CommandLine.arguments[1]

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
    if let candidate = obs.topCandidates(1).first {
        print(candidate.string)
    }
}

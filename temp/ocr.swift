import Foundation
import Vision
import AppKit

// Usage: swift ocr.swift <image-path>
// Prints recognized text lines from the image (top to bottom, roughly by y).

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cgImage = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERR: cannot load image at \(path)")
    exit(1)
}

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

struct Line { let y: CGFloat; let text: String }
var lines: [Line] = []
for obs in request.results ?? [] {
    guard let top = obs.topCandidates(1).first else { continue }
    let y = obs.boundingBox.midY
    lines.append(Line(y: y, text: top.string))
}
// Sort top-to-bottom (image coords: higher midY = higher on screen)
lines.sort { $0.y > $1.y }
for l in lines {
    print(l.text)
}

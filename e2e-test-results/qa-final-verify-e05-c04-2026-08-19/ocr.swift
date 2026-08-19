import Foundation
import Vision
import AppKit

// QA evidence OCR helper — macOS Vision framework text recognition with bounding boxes.
// Usage: swift ocr.swift <image-path>
// Output: per line "text | cx cy w h" in image pixel coordinates (origin top-left).

let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: ocr.swift <image>"); exit(1) }
let path = args[1]
guard let img = NSImage(contentsOfFile: path),
      let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let cg = rep.cgImage else {
    print("ERR: cannot load image \(path)"); exit(2)
}
let W = CGFloat(cg.width)
let H = CGFloat(cg.height)

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try? handler.perform([request])

let results = (request.results ?? []).sorted { a, b in
    let ay = a.boundingBox.midY
    let by = b.boundingBox.midY
    if abs(ay - by) > 0.01 { return ay > by }
    return a.boundingBox.minX < b.boundingBox.minX
}
for obs in results {
    guard let cand = obs.topCandidates(1).first else { continue }
    let b = obs.boundingBox
    // Vision origin is bottom-left; convert to top-left pixel coords.
    let cx = (b.midX) * W
    let cy = (1.0 - b.midY) * H
    let cw = b.width * W
    let ch = b.height * H
    print("\(cand.string) | \(Int(cx.rounded())) \(Int(cy.rounded())) \(Int(cw.rounded())) \(Int(ch.rounded()))")
}

// ocr.swift — QA evidence-inspection helper (run archive only).
// Usage: swift ocr.swift <image.png> [width] [height]
// Prints recognized text with bounding boxes in PIXELS (default 1320x2868 = 3x scale).
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2, let img = NSImage(contentsOfFile: args[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("Cannot load image\n", stderr); exit(1)
}
let W = args.count >= 3 ? CGFloat(Double(args[2]) ?? 1320) : 1320
let H = args.count >= 4 ? CGFloat(Double(args[3]) ?? 2868) : 2868
let req = VNRecognizeTextRequest { r, _ in
    guard let obs = r.results as? [VNRecognizedTextObservation] else { return }
    for o in obs {
        if let t = o.topCandidates(1).first {
            let b = o.boundingBox
            let x = b.origin.x * W
            let y = (1 - b.origin.y - b.size.height) * H
            let w = b.size.width * W
            let h = b.size.height * H
            print(String(format: "%.0f,%.0f %.0fx%.0f | %@", x, y, w, h, t.string))
        }
    }
}
req.recognitionLevel = .accurate
req.usesLanguageCorrection = false
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try? handler.perform([req])

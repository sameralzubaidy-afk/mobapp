import Foundation
import AppKit

// QA evidence pixel scanner — find pixels near a target color in an image.
// Usage: swift pixelscan.swift <image> <hexColor> <tolerance> [yStart yEnd]
// Output: count, x/y min/max, and y-band histogram (20px bands) of matching pixels.

let args = CommandLine.arguments
guard args.count >= 4, let img = NSImage(contentsOfFile: args[1]),
      let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else {
    print("usage: pixelscan.swift <image> <hex> <tol> [yStart yEnd]"); exit(1)
}
var hex = args[2]
if hex.hasPrefix("#") { hex.removeFirst() }
let r0 = UInt8(strtoul(String(hex.prefix(2)), nil, 16))
let g0 = UInt8(strtoul(String(hex.dropFirst(2).prefix(2)), nil, 16))
let b0 = UInt8(strtoul(String(hex.dropFirst(4).prefix(2)), nil, 16))
let tol = Int(args[3]) ?? 10
let W = rep.pixelsWide, H = rep.pixelsHigh
let yStart = args.count > 4 ? Int(args[4]) ?? 0 : 0
let yEnd = args.count > 5 ? min(Int(args[5]) ?? H, H) : H

var found: [(Int, Int)] = []
for y in yStart..<yEnd {
    for x in 0..<W {
        guard let c = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
        let r = Int(c.redComponent * 255), g = Int(c.greenComponent * 255), b = Int(c.blueComponent * 255)
        if abs(r - Int(r0)) <= tol && abs(g - Int(g0)) <= tol && abs(b - Int(b0)) <= tol {
            found.append((x, y))
        }
    }
}
print("size \(W)x\(H) scan y \(yStart)..\(yEnd) target #\(String(format:"%02X%02X%02X", r0, g0, b0)) tol \(tol)")
if found.isEmpty { print("NO_MATCH") ; exit(0) }
let xs = found.map { $0.0 }, ys = found.map { $0.1 }
print("count \(found.count) x \(xs.min()!)..\(xs.max()!) y \(ys.min()!)..\(ys.max()!)")
var bands: [Int: Int] = [:]
for y in ys { bands[y / 20 * 20, default: 0] += 1 }
for k in bands.keys.sorted() { print("band y=\(k): \(bands[k]!)") }

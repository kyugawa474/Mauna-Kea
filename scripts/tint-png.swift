import AppKit
// usage: tint-png <in.png> <hex RRGGBB> <out.png> — recolours every pixel, keeping its alpha.
let a = CommandLine.arguments
guard let src = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: a[1]))) else { exit(1) }
let hex = Int(a[2], radix: 16)!
let (r, g, b) = (CGFloat((hex >> 16) & 255) / 255, CGFloat((hex >> 8) & 255) / 255, CGFloat(hex & 255) / 255)
let out = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: src.pixelsWide, pixelsHigh: src.pixelsHigh, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
out.size = src.size
for y in 0..<src.pixelsHigh { for x in 0..<src.pixelsWide {
  let al = src.colorAt(x: x, y: y)?.alphaComponent ?? 0
  out.setColor(NSColor(deviceRed: r, green: g, blue: b, alpha: al), atX: x, y: y)
} }
try! out.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))

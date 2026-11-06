import AppKit
// usage: render <symbol> <weight:light> <pointSize> <scale> <out.png>
let a = CommandLine.arguments
let name = a[1], size = CGFloat(Double(a[3])!), scale = CGFloat(Double(a[4])!), out = a[5]
let weights: [String: NSFont.Weight] = ["ultralight": .ultraLight, "thin": .thin, "light": .light, "regular": .regular]
let cfg = NSImage.SymbolConfiguration(pointSize: size, weight: weights[a[2]]!)
    .applying(NSImage.SymbolConfiguration(paletteColors: [.black]))
guard let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(cfg) else {
  FileHandle.standardError.write("no symbol \(name)\n".data(using: .utf8)!); exit(1)
}
// Square canvas sized like the existing tab images (25pt), symbol centred.
let side: CGFloat = 28
let px = Int(side * scale)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: side, height: side)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let s = img.size
img.draw(in: NSRect(x: (side - s.width) / 2, y: (side - s.height) / 2, width: s.width, height: s.height))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print(name, s)

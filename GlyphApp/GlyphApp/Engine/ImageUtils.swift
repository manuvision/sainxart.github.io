import UIKit
import CoreImage
import CoreVideo
import SwiftUI

struct ImageUtils {
    /// Extract 7 palette colors from image by sampling brightness percentiles
    static func extractPalette(from image: CGImage) -> [Color] {
        let targetSize = CGSize(width: 64, height: 64)
        guard let sampled = resizeCGImage(image, to: targetSize) else {
            return []
        }

        guard let pixelData = sampled.dataProvider?.data,
              let data = CFDataGetBytePtr(pixelData) else {
            return []
        }

        let width = sampled.width
        let height = sampled.height
        let bpp = sampled.bitsPerPixel / 8
        let bpr = sampled.bytesPerRow

        struct PixelInfo {
            let r: CGFloat
            let g: CGFloat
            let b: CGFloat
            var luminance: CGFloat { 0.299 * r + 0.587 * g + 0.114 * b }
        }

        var pixels: [PixelInfo] = []
        pixels.reserveCapacity(width * height)

        for y in 0..<height {
            for x in 0..<width {
                let offset = y * bpr + x * bpp
                let r = CGFloat(data[offset]) / 255.0
                let g = CGFloat(data[offset + 1]) / 255.0
                let b = CGFloat(data[offset + 2]) / 255.0
                pixels.append(PixelInfo(r: r, g: g, b: b))
            }
        }

        pixels.sort { $0.luminance < $1.luminance }

        // Percentiles from bright to dark: [0.96, 0.83, 0.69, 0.50, 0.31, 0.17, 0.04]
        let percentiles: [Double] = [0.96, 0.83, 0.69, 0.50, 0.31, 0.17, 0.04]
        let count = pixels.count

        return percentiles.map { p in
            let idx = max(0, min(count - 1, Int(Double(count - 1) * p)))
            let px = pixels[idx]
            return Color(red: px.r, green: px.g, blue: px.b)
        }
    }

    /// Extract palette from CVPixelBuffer
    static func extractPalette(from pixelBuffer: CVPixelBuffer) -> [Color] {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            return []
        }
        return extractPalette(from: cgImage)
    }

    /// Resize CGImage to target size
    static func resizeCGImage(_ image: CGImage, to size: CGSize) -> CGImage? {
        let w = Int(size.width)
        let h = Int(size.height)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: nil,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.interpolationQuality = .low
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        return ctx.makeImage()
    }

    /// Downsample image to grid dimensions, return brightness per cell
    static func sampleBrightness(from image: CGImage, cols: Int, rows: Int) -> [[CGFloat]] {
        guard let sampled = resizeCGImage(image, to: CGSize(width: cols, height: rows)) else {
            return Array(repeating: Array(repeating: 0.5, count: cols), count: rows)
        }
        guard let pixelData = sampled.dataProvider?.data,
              let data = CFDataGetBytePtr(pixelData) else {
            return Array(repeating: Array(repeating: 0.5, count: cols), count: rows)
        }

        let bpp = sampled.bitsPerPixel / 8
        let bpr = sampled.bytesPerRow
        var result = Array(repeating: Array(repeating: CGFloat(0), count: cols), count: rows)

        for y in 0..<rows {
            for x in 0..<cols {
                let offset = y * bpr + x * bpp
                let r = CGFloat(data[offset]) / 255.0
                let g = CGFloat(data[offset + 1]) / 255.0
                let b = CGFloat(data[offset + 2]) / 255.0
                result[y][x] = 0.299 * r + 0.587 * g + 0.114 * b
            }
        }
        return result
    }

    /// Convert CGImage to UIImage
    static func cgImageToUIImage(_ cgImage: CGImage) -> UIImage {
        UIImage(cgImage: cgImage)
    }

    /// Render UIView to UIImage
    static func renderToImage(view: UIView) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: view.bounds.size)
        return renderer.image { _ in
            view.drawHierarchy(in: view.bounds, afterScreenUpdates: true)
        }
    }

    /// Convert CVPixelBuffer to CGImage
    static func cgImage(from pixelBuffer: CVPixelBuffer) -> CGImage? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()
        return context.createCGImage(ciImage, from: ciImage.extent)
    }
}

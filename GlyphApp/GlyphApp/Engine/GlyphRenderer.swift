import UIKit
import CoreGraphics

struct DepthParams {
    var spread: Double
    var invert: Bool
    var rotX: Double   // horizontal tilt angle in radians
    var rotY: Double   // vertical tilt angle in radians
}

struct RenderParams {
    var grid: Int
    var fillSolid: Bool
    var invertMap: Bool
    var scaleMin: Double
    var scaleMax: Double
    var depth: DepthParams
    var colors: [UIColor]
    var glyphIDs: [String]
    var stateRotations: [Int]
    var bgColor: UIColor
}

class GlyphRenderer {

    // MARK: - Main Render

    /// Render glyph dither effect into a CGContext, given a source image.
    static func render(
        image: CGImage,
        in context: CGContext,
        canvasSize: CGSize,
        params: RenderParams
    ) {
        let grid = max(1, params.grid)
        let canvasW = canvasSize.width
        let canvasH = canvasSize.height

        let cellW = canvasW / CGFloat(grid)
        let cellH = canvasH / CGFloat(grid)
        let rows = Int(ceil(canvasH / cellH))
        let cols = grid

        // Sample brightness grid
        let brightness = ImageUtils.sampleBrightness(from: image, cols: cols, rows: rows)

        // Draw background
        context.setFillColor(params.bgColor.cgColor)
        context.fill(CGRect(origin: .zero, size: canvasSize))

        // Draw each cell
        for row in 0..<rows {
            for col in 0..<cols {
                guard row < brightness.count, col < brightness[row].count else { continue }

                var b = brightness[row][col]  // 0.0 = black, 1.0 = white

                if params.invertMap {
                    b = 1.0 - b
                }

                // Map brightness to state index (0=highlights, 6=shadows)
                let displayIdx = min(6, max(0, 6 - Int(b * 7)))

                // Scale based on brightness
                let t = b
                let scale = params.scaleMin + t * (params.scaleMax - params.scaleMin)

                // Base cell center
                var cx = (CGFloat(col) + 0.5) * cellW
                var cy = (CGFloat(row) + 0.5) * cellH

                // Depth displacement
                if params.depth.spread != 0 {
                    let depthZ = (Double(displayIdx) - 3.0) * params.depth.spread * (params.depth.invert ? -1.0 : 1.0)
                    cx += CGFloat(depthZ * sin(params.depth.rotY))
                    cy -= CGFloat(depthZ * sin(params.depth.rotX))
                }

                // Compute glyph rect centered at (cx, cy)
                let glyphSize = CGSize(width: cellW * CGFloat(scale), height: cellH * CGFloat(scale))
                let glyphRect = CGRect(
                    x: cx - glyphSize.width / 2,
                    y: cy - glyphSize.height / 2,
                    width: glyphSize.width,
                    height: glyphSize.height
                )

                // Get glyph shape
                let glyphID = params.glyphIDs[safe: displayIdx] ?? "square"
                guard let shape = GlyphShape(rawValue: glyphID) else { continue }

                let color = params.colors[safe: displayIdx] ?? UIColor.white
                let rotation = params.stateRotations[safe: displayIdx] ?? 0

                // Draw the glyph
                drawGlyph(
                    shape: shape,
                    in: glyphRect,
                    rotation: rotation,
                    color: color,
                    context: context,
                    cellSize: min(cellW, cellH),
                    fillSolid: params.fillSolid
                )
            }
        }
    }

    // MARK: - Draw Single Glyph

    private static func drawGlyph(
        shape: GlyphShape,
        in rect: CGRect,
        rotation: Int,
        color: UIColor,
        context: CGContext,
        cellSize: CGFloat,
        fillSolid: Bool
    ) {
        context.saveGState()

        // Apply rotation around glyph center
        if rotation != 0 {
            let cx = rect.midX
            let cy = rect.midY
            context.translateBy(x: cx, y: cy)
            context.rotate(by: CGFloat(rotation) * .pi / 180.0)
            context.translateBy(x: -cx, y: -cy)
        }

        context.setFillColor(color.cgColor)
        context.setStrokeColor(color.cgColor)

        let instructions = GlyphPaths.drawInstructions(for: shape, in: rect)

        // Calculate stroke width scaled from 24pt coordinate space
        let rawStrokeWidth = GlyphPaths.strokeWidth(for: shape)
        let scaledStrokeWidth = rawStrokeWidth * (rect.width / 24.0)
        context.setLineWidth(scaledStrokeWidth)
        context.setLineCap(GlyphPaths.lineCap(for: shape))
        context.setLineJoin(.round)

        for (path, isFill) in instructions {
            context.addPath(path)
            if fillSolid || isFill {
                context.fillPath()
            } else {
                context.strokePath()
            }
        }

        context.restoreGState()
    }

    // MARK: - Render to UIImage

    static func renderToImage(
        source: CGImage,
        canvasSize: CGSize,
        params: RenderParams
    ) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        return renderer.image { rendererContext in
            let cgContext = rendererContext.cgContext
            render(image: source, in: cgContext, canvasSize: canvasSize, params: params)
        }
    }
}

// MARK: - Safe Array Subscript

extension Array {
    subscript(safe index: Int) -> Element? {
        guard index >= 0 && index < count else { return nil }
        return self[index]
    }
}

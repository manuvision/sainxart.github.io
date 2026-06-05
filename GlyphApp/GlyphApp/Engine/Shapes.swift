import CoreGraphics
import UIKit

// MARK: - GlyphShape enum

enum GlyphShape: String, CaseIterable, Identifiable {
    // GEO
    case circle = "circle"
    case ring = "ring"
    case square = "square"
    case sqOut = "sq-out"
    case rounded = "rounded"
    case triUp = "tri-up"
    case triDn = "tri-dn"
    case diamond = "diamond"
    case diaOut = "dia-out"
    case hexagon = "hexagon"

    // LINES
    case plus = "plus"
    case xMark = "x-mark"
    case asterisk = "asterisk"
    case hash = "hash"
    case slash = "slash"
    case bslash = "bslash"

    // STARS
    case star4 = "star-4"
    case star5 = "star-5"
    case star6 = "star-6"

    // ASCII
    case dotSm = "dot-sm"
    case dots4 = "dots-4"
    case hLines = "h-lines"
    case vLines = "v-lines"
    case xhatch = "xhatch"
    case block = "block"

    // DECO
    case heart = "heart"
    case spiral = "spiral"
    case arrowR = "arrow-r"
    case eye = "eye"
    case smiley = "smiley"
    case leaf = "leaf"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .circle: return "Circle"
        case .ring: return "Ring"
        case .square: return "Square"
        case .sqOut: return "Sq Out"
        case .rounded: return "Rounded"
        case .triUp: return "Tri Up"
        case .triDn: return "Tri Dn"
        case .diamond: return "Diamond"
        case .diaOut: return "Dia Out"
        case .hexagon: return "Hexagon"
        case .plus: return "Plus"
        case .xMark: return "X Mark"
        case .asterisk: return "Asterisk"
        case .hash: return "Hash"
        case .slash: return "Slash"
        case .bslash: return "Bslash"
        case .star4: return "Star 4"
        case .star5: return "Star 5"
        case .star6: return "Star 6"
        case .dotSm: return "Dot Sm"
        case .dots4: return "Dots 4"
        case .hLines: return "H Lines"
        case .vLines: return "V Lines"
        case .xhatch: return "Xhatch"
        case .block: return "Block"
        case .heart: return "Heart"
        case .spiral: return "Spiral"
        case .arrowR: return "Arrow R"
        case .eye: return "Eye"
        case .smiley: return "Smiley"
        case .leaf: return "Leaf"
        }
    }

    var category: GlyphCategory {
        switch self {
        case .circle, .ring, .square, .sqOut, .rounded, .triUp, .triDn, .diamond, .diaOut, .hexagon:
            return .geo
        case .plus, .xMark, .asterisk, .hash, .slash, .bslash:
            return .lines
        case .star4, .star5, .star6:
            return .stars
        case .dotSm, .dots4, .hLines, .vLines, .xhatch, .block:
            return .ascii
        case .heart, .spiral, .arrowR, .eye, .smiley, .leaf:
            return .deco
        }
    }

    /// Whether this shape is drawn with stroke (true) or fill (false)
    var isStroke: Bool {
        switch self {
        case .ring, .sqOut, .diaOut, .xMark, .asterisk, .hash, .slash, .bslash, .xhatch, .spiral:
            return true
        default:
            return false
        }
    }
}

enum GlyphCategory: String, CaseIterable, Identifiable {
    case all = "All"
    case geo = "Geo"
    case lines = "Lines"
    case stars = "Stars"
    case ascii = "ASCII"
    case deco = "Deco"

    var id: String { rawValue }
}

// MARK: - Path building in 24×24 viewBox, then scaled to unit square

struct GlyphPaths {
    /// Returns draw instructions for a glyph at given rect.
    /// Each instruction is either (path, isFill) or can be multiple paths.
    static func drawInstructions(for shape: GlyphShape, in rect: CGRect) -> [(CGPath, Bool)] {
        let scale = CGAffineTransform(scaleX: rect.width / 24.0, y: rect.height / 24.0)
            .concatenating(CGAffineTransform(translationX: rect.minX, y: rect.minY))

        func transform(_ path: CGMutablePath) -> CGPath {
            return path.copy(using: [scale]) ?? path
        }

        switch shape {

        // MARK: GEO
        case .circle:
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 2, y: 2, width: 20, height: 20))
            return [(transform(p), true)]

        case .ring:
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 3.5, y: 3.5, width: 17, height: 17))
            return [(transform(p), false)]

        case .square:
            let p = CGMutablePath()
            p.addRect(CGRect(x: 2, y: 2, width: 20, height: 20))
            return [(transform(p), true)]

        case .sqOut:
            let p = CGMutablePath()
            p.addRect(CGRect(x: 3, y: 3, width: 18, height: 18))
            return [(transform(p), false)]

        case .rounded:
            let p = CGMutablePath()
            p.addRoundedRect(in: CGRect(x: 2, y: 2, width: 20, height: 20), cornerWidth: 6, cornerHeight: 6)
            return [(transform(p), true)]

        case .triUp:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 2))
            p.addLine(to: CGPoint(x: 22, y: 22))
            p.addLine(to: CGPoint(x: 2, y: 22))
            p.closeSubpath()
            return [(transform(p), true)]

        case .triDn:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 2, y: 2))
            p.addLine(to: CGPoint(x: 22, y: 2))
            p.addLine(to: CGPoint(x: 12, y: 22))
            p.closeSubpath()
            return [(transform(p), true)]

        case .diamond:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 1))
            p.addLine(to: CGPoint(x: 23, y: 12))
            p.addLine(to: CGPoint(x: 12, y: 23))
            p.addLine(to: CGPoint(x: 1, y: 12))
            p.closeSubpath()
            return [(transform(p), true)]

        case .diaOut:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 1))
            p.addLine(to: CGPoint(x: 23, y: 12))
            p.addLine(to: CGPoint(x: 12, y: 23))
            p.addLine(to: CGPoint(x: 1, y: 12))
            p.closeSubpath()
            return [(transform(p), false)]

        case .hexagon:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 2))
            p.addLine(to: CGPoint(x: 20.7, y: 7))
            p.addLine(to: CGPoint(x: 20.7, y: 17))
            p.addLine(to: CGPoint(x: 12, y: 22))
            p.addLine(to: CGPoint(x: 3.3, y: 17))
            p.addLine(to: CGPoint(x: 3.3, y: 7))
            p.closeSubpath()
            return [(transform(p), true)]

        // MARK: LINES
        case .plus:
            let p = CGMutablePath()
            p.addRect(CGRect(x: 9, y: 1, width: 6, height: 22))
            p.addRect(CGRect(x: 1, y: 9, width: 22, height: 6))
            return [(transform(p), true)]

        case .xMark:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 3, y: 3))
            p.addLine(to: CGPoint(x: 21, y: 21))
            p.move(to: CGPoint(x: 21, y: 3))
            p.addLine(to: CGPoint(x: 3, y: 21))
            return [(transform(p), false)]

        case .asterisk:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 3))
            p.addLine(to: CGPoint(x: 12, y: 21))
            p.move(to: CGPoint(x: 3, y: 12))
            p.addLine(to: CGPoint(x: 21, y: 12))
            p.move(to: CGPoint(x: 5.6, y: 5.6))
            p.addLine(to: CGPoint(x: 18.4, y: 18.4))
            p.move(to: CGPoint(x: 18.4, y: 5.6))
            p.addLine(to: CGPoint(x: 5.6, y: 18.4))
            return [(transform(p), false)]

        case .hash:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 8, y: 2))
            p.addLine(to: CGPoint(x: 8, y: 22))
            p.move(to: CGPoint(x: 16, y: 2))
            p.addLine(to: CGPoint(x: 16, y: 22))
            p.move(to: CGPoint(x: 2, y: 8))
            p.addLine(to: CGPoint(x: 22, y: 8))
            p.move(to: CGPoint(x: 2, y: 16))
            p.addLine(to: CGPoint(x: 22, y: 16))
            return [(transform(p), false)]

        case .slash:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 4, y: 22))
            p.addLine(to: CGPoint(x: 20, y: 2))
            return [(transform(p), false)]

        case .bslash:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 4, y: 2))
            p.addLine(to: CGPoint(x: 20, y: 22))
            return [(transform(p), false)]

        // MARK: STARS
        case .star4:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 2))
            p.addLine(to: CGPoint(x: 14.2, y: 9.8))
            p.addLine(to: CGPoint(x: 22, y: 12))
            p.addLine(to: CGPoint(x: 14.2, y: 14.2))
            p.addLine(to: CGPoint(x: 12, y: 22))
            p.addLine(to: CGPoint(x: 9.8, y: 14.2))
            p.addLine(to: CGPoint(x: 2, y: 12))
            p.addLine(to: CGPoint(x: 9.8, y: 9.8))
            p.closeSubpath()
            return [(transform(p), true)]

        case .star5:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 2))
            p.addLine(to: CGPoint(x: 14.4, y: 9.2))
            p.addLine(to: CGPoint(x: 22, y: 9.5))
            p.addLine(to: CGPoint(x: 16.2, y: 14.3))
            p.addLine(to: CGPoint(x: 18.5, y: 22))
            p.addLine(to: CGPoint(x: 12, y: 17.3))
            p.addLine(to: CGPoint(x: 5.5, y: 22))
            p.addLine(to: CGPoint(x: 7.8, y: 14.3))
            p.addLine(to: CGPoint(x: 2, y: 9.5))
            p.addLine(to: CGPoint(x: 9.6, y: 9.2))
            p.closeSubpath()
            return [(transform(p), true)]

        case .star6:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 2))
            p.addLine(to: CGPoint(x: 14.5, y: 7.7))
            p.addLine(to: CGPoint(x: 20.7, y: 7))
            p.addLine(to: CGPoint(x: 17, y: 12))
            p.addLine(to: CGPoint(x: 20.7, y: 17))
            p.addLine(to: CGPoint(x: 14.5, y: 16.3))
            p.addLine(to: CGPoint(x: 12, y: 22))
            p.addLine(to: CGPoint(x: 9.5, y: 16.3))
            p.addLine(to: CGPoint(x: 3.3, y: 17))
            p.addLine(to: CGPoint(x: 7, y: 12))
            p.addLine(to: CGPoint(x: 3.3, y: 7))
            p.addLine(to: CGPoint(x: 9.5, y: 7.7))
            p.closeSubpath()
            return [(transform(p), true)]

        // MARK: ASCII
        case .dotSm:
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 8, y: 8, width: 8, height: 8))
            return [(transform(p), true)]

        case .dots4:
            let p = CGMutablePath()
            p.addEllipse(in: CGRect(x: 4, y: 4, width: 6, height: 6))
            p.addEllipse(in: CGRect(x: 14, y: 4, width: 6, height: 6))
            p.addEllipse(in: CGRect(x: 4, y: 14, width: 6, height: 6))
            p.addEllipse(in: CGRect(x: 14, y: 14, width: 6, height: 6))
            return [(transform(p), true)]

        case .hLines:
            let p = CGMutablePath()
            for y in [1.0, 7.0, 13.0, 19.0] {
                p.addRect(CGRect(x: 0, y: y, width: 24, height: 2.5))
            }
            return [(transform(p), true)]

        case .vLines:
            let p = CGMutablePath()
            for x in [1.0, 7.0, 13.0, 19.0] {
                p.addRect(CGRect(x: x, y: 0, width: 2.5, height: 24))
            }
            return [(transform(p), true)]

        case .xhatch:
            let p = CGMutablePath()
            let lines: [(CGPoint, CGPoint)] = [
                (CGPoint(x: 0, y: 0), CGPoint(x: 24, y: 24)),
                (CGPoint(x: 6, y: 0), CGPoint(x: 24, y: 18)),
                (CGPoint(x: 12, y: 0), CGPoint(x: 24, y: 12)),
                (CGPoint(x: 18, y: 0), CGPoint(x: 24, y: 6)),
                (CGPoint(x: 0, y: 6), CGPoint(x: 18, y: 24)),
                (CGPoint(x: 0, y: 12), CGPoint(x: 12, y: 24)),
                (CGPoint(x: 0, y: 18), CGPoint(x: 6, y: 24)),
                (CGPoint(x: 0, y: 24), CGPoint(x: 24, y: 0)),
                (CGPoint(x: 0, y: 18), CGPoint(x: 18, y: 0)),
                (CGPoint(x: 0, y: 12), CGPoint(x: 12, y: 0)),
                (CGPoint(x: 0, y: 6), CGPoint(x: 6, y: 0)),
                (CGPoint(x: 6, y: 24), CGPoint(x: 24, y: 6)),
                (CGPoint(x: 12, y: 24), CGPoint(x: 24, y: 12)),
                (CGPoint(x: 18, y: 24), CGPoint(x: 24, y: 18))
            ]
            for (start, end) in lines {
                p.move(to: start)
                p.addLine(to: end)
            }
            return [(transform(p), false)]

        case .block:
            let p = CGMutablePath()
            p.addRect(CGRect(x: 0, y: 0, width: 24, height: 24))
            return [(transform(p), true)]

        // MARK: DECO
        case .heart:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 20.5))
            p.addCurve(to: CGPoint(x: 2, y: 7.5),
                       control1: CGPoint(x: 11, y: 19.5),
                       control2: CGPoint(x: 2, y: 14))
            p.addCurve(to: CGPoint(x: 7.5, y: 2.5),
                       control1: CGPoint(x: 2, y: 4.5),
                       control2: CGPoint(x: 4.5, y: 2.5))
            p.addCurve(to: CGPoint(x: 12, y: 5),
                       control1: CGPoint(x: 9.5, y: 2.5),
                       control2: CGPoint(x: 11, y: 3.5))
            p.addCurve(to: CGPoint(x: 16.5, y: 2.5),
                       control1: CGPoint(x: 13, y: 3.5),
                       control2: CGPoint(x: 14.5, y: 2.5))
            p.addCurve(to: CGPoint(x: 22, y: 7.5),
                       control1: CGPoint(x: 19.5, y: 2.5),
                       control2: CGPoint(x: 22, y: 4.5))
            p.addCurve(to: CGPoint(x: 12, y: 20.5),
                       control1: CGPoint(x: 22, y: 14),
                       control2: CGPoint(x: 13, y: 19.5))
            p.closeSubpath()
            return [(transform(p), true)]

        case .spiral:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 12))
            p.addQuadCurve(to: CGPoint(x: 16, y: 8.5), control: CGPoint(x: 16, y: 12))
            p.addQuadCurve(to: CGPoint(x: 11.5, y: 4), control: CGPoint(x: 16, y: 4))
            p.addQuadCurve(to: CGPoint(x: 5, y: 9.5), control: CGPoint(x: 6, y: 4))
            p.addQuadCurve(to: CGPoint(x: 8.5, y: 19), control: CGPoint(x: 4, y: 15.5))
            p.addQuadCurve(to: CGPoint(x: 19, y: 19), control: CGPoint(x: 13.5, y: 22.5))
            p.addQuadCurve(to: CGPoint(x: 22, y: 9), control: CGPoint(x: 23.5, y: 15))
            return [(transform(p), false)]

        case .arrowR:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 3, y: 10))
            p.addLine(to: CGPoint(x: 17.2, y: 10))
            p.addLine(to: CGPoint(x: 12.1, y: 4.9))
            p.addLine(to: CGPoint(x: 13.6, y: 3.5))
            p.addLine(to: CGPoint(x: 21, y: 12))
            p.addLine(to: CGPoint(x: 13.6, y: 20.5))
            p.addLine(to: CGPoint(x: 12.1, y: 19.1))
            p.addLine(to: CGPoint(x: 17.2, y: 14))
            p.addLine(to: CGPoint(x: 3, y: 14))
            p.closeSubpath()
            return [(transform(p), true)]

        case .eye:
            // Outer eye shape (stroke)
            let outer = CGMutablePath()
            outer.move(to: CGPoint(x: 2, y: 12))
            outer.addCurve(to: CGPoint(x: 12, y: 4),
                           control1: CGPoint(x: 5, y: 7),
                           control2: CGPoint(x: 10, y: 4))
            outer.addCurve(to: CGPoint(x: 22, y: 12),
                           control1: CGPoint(x: 14, y: 4),
                           control2: CGPoint(x: 19, y: 7))
            outer.addCurve(to: CGPoint(x: 12, y: 20),
                           control1: CGPoint(x: 19, y: 17),
                           control2: CGPoint(x: 14, y: 20))
            outer.addCurve(to: CGPoint(x: 2, y: 12),
                           control1: CGPoint(x: 10, y: 20),
                           control2: CGPoint(x: 5, y: 17))
            outer.closeSubpath()

            // Inner pupil (fill)
            let inner = CGMutablePath()
            inner.addEllipse(in: CGRect(x: 8, y: 8, width: 8, height: 8))

            return [(transform(outer), false), (transform(inner), true)]

        case .smiley:
            // Face circle (stroke)
            let face = CGMutablePath()
            face.addEllipse(in: CGRect(x: 2, y: 2, width: 20, height: 20))

            // Left eye
            let leftEye = CGMutablePath()
            leftEye.addEllipse(in: CGRect(x: 7, y: 8, width: 3, height: 3))

            // Right eye
            let rightEye = CGMutablePath()
            rightEye.addEllipse(in: CGRect(x: 14, y: 8, width: 3, height: 3))

            // Mouth
            let mouth = CGMutablePath()
            mouth.move(to: CGPoint(x: 8, y: 14.5))
            mouth.addQuadCurve(to: CGPoint(x: 16, y: 14.5), control: CGPoint(x: 12, y: 18.5))

            return [
                (transform(face), false),
                (transform(leftEye), true),
                (transform(rightEye), true),
                (transform(mouth), false)
            ]

        case .leaf:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: 12, y: 3))
            p.addCurve(to: CGPoint(x: 21, y: 14),
                       control1: CGPoint(x: 12, y: 3),
                       control2: CGPoint(x: 21, y: 8))
            p.addCurve(to: CGPoint(x: 12, y: 21.5),
                       control1: CGPoint(x: 21, y: 18.4),
                       control2: CGPoint(x: 16.9, y: 21.5))
            p.addCurve(to: CGPoint(x: 3, y: 14),
                       control1: CGPoint(x: 7.1, y: 21.5),
                       control2: CGPoint(x: 3, y: 18.4))
            p.addCurve(to: CGPoint(x: 12, y: 3),
                       control1: CGPoint(x: 3, y: 8),
                       control2: CGPoint(x: 12, y: 3))
            p.closeSubpath()
            return [(transform(p), true)]
        }
    }

    /// Returns stroke width in the 24×24 coordinate space
    static func strokeWidth(for shape: GlyphShape) -> CGFloat {
        switch shape {
        case .ring: return 3.0
        case .sqOut: return 3.0
        case .diaOut: return 2.5
        case .xMark: return 5.0
        case .asterisk: return 2.5
        case .hash: return 2.5
        case .slash: return 4.5
        case .bslash: return 4.5
        case .xhatch: return 1.8
        case .spiral: return 2.5
        case .eye: return 1.5
        case .smiley: return 1.5
        default: return 1.5
        }
    }

    /// Returns cap style for stroke shapes
    static func lineCap(for shape: GlyphShape) -> CGLineCap {
        switch shape {
        case .xMark, .asterisk, .slash, .bslash, .spiral:
            return .round
        default:
            return .butt
        }
    }
}

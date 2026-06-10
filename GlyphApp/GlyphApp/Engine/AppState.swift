import SwiftUI
import Combine

enum AspectRatio: String, CaseIterable, Identifiable {
    case original = "Orig"
    case oneToOne = "1:1"
    case sixteenNine = "16:9"
    case nineSixteen = "9:16"

    var id: String { rawValue }

    var ratio: CGFloat? {
        switch self {
        case .original: return nil
        case .oneToOne: return 1.0
        case .sixteenNine: return 16.0 / 9.0
        case .nineSixteen: return 9.0 / 16.0
        }
    }
}

class AppState: ObservableObject {
    // Grid
    @Published var grid: Int = 32

    // Background
    @Published var bgColor: Color = .black

    // Aspect ratio
    @Published var aspectRatio: AspectRatio = .original

    // Fill mode
    @Published var fillSolid: Bool = false

    // Invert mapping
    @Published var invertMap: Bool = false

    // Scale
    @Published var scaleMin: Double = 1.0
    @Published var scaleMax: Double = 1.0

    // Depth
    @Published var depthSpread: Double = 0
    @Published var depthInvert: Bool = false
    @Published var depthAnim: Bool = false

    // Auto randomize
    @Published var autoRandom: Bool = false
    @Published var flickerSpeed: Double = 8
    @Published var variedRhythm: Bool = false

    // Grid animation
    @Published var gridAnim: Bool = false
    @Published var gridAnimSpeed: Double = 0.05

    // 7 state colors (highlights → shadows)
    @Published var colors: [Color] = [
        Color(hex: "#ffffff"),
        Color(hex: "#d8d8d8"),
        Color(hex: "#aaaaaa"),
        Color(hex: "#777777"),
        Color(hex: "#4d4d4d"),
        Color(hex: "#2a2a2a"),
        Color(hex: "#111111")
    ]

    // 7 state glyph IDs
    @Published var glyphIDs: [String] = [
        "square",
        "x-mark",
        "sq-out",
        "ring",
        "asterisk",
        "dots-4",
        "dot-sm"
    ]

    // 7 state rotations (degrees: 0, 90, 180, 270)
    @Published var stateRotations: [Int] = [0, 0, 0, 0, 0, 0, 0]

    // Palette selection
    @Published var palSelected: Int? = nil  // nil = none, -1 = image, 0-11 = preset
    @Published var palReversed: Bool = false

    // State labels
    static let stateNames = ["STATE 1", "STATE 2", "STATE 3", "STATE 4", "STATE 5", "STATE 6", "STATE 7"]
    static let stateLabels = ["HIGHLIGHTS", "LIGHT MID", "MID HIGH", "MIDTONES", "MID LOW", "DARK MID", "SHADOWS"]

    // Default glyphs for preset button
    static let defaultGlyphs = ["square", "x-mark", "sq-out", "ring", "asterisk", "dots-4", "dot-sm"]
    static let presetGlyphs = ["circle", "tri-dn", "tri-up", "diamond", "heart", "leaf", "rounded"]

    func applyPalette(_ palette: [Color]) {
        for i in 0..<min(7, palette.count) {
            colors[i] = palette[i]
        }
    }

    func randomizeGlyphs() {
        let allIDs = GlyphShape.allCases.map { $0.rawValue }
        for i in 0..<7 {
            glyphIDs[i] = allIDs.randomElement() ?? glyphIDs[i]
        }
    }

    func resetToDefaults() {
        glyphIDs = Self.defaultGlyphs
        stateRotations = [0, 0, 0, 0, 0, 0, 0]
        colors = [
            Color(hex: "#ffffff"),
            Color(hex: "#d8d8d8"),
            Color(hex: "#aaaaaa"),
            Color(hex: "#777777"),
            Color(hex: "#4d4d4d"),
            Color(hex: "#2a2a2a"),
            Color(hex: "#111111")
        ]
        palSelected = nil
        palReversed = false
    }
}

extension Color {
    init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }

    var hexString: String {
        guard let components = UIColor(self).cgColor.components, components.count >= 3 else {
            return "#000000"
        }
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02x%02x%02x", r, g, b)
    }

    var uiColor: UIColor { UIColor(self) }
}

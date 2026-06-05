import SwiftUI

struct GlyphPalette: Identifiable {
    let id: Int
    let name: String
    let colors: [Color]
}

struct Palettes {
    static let presets: [GlyphPalette] = [
        GlyphPalette(id: 0,  name: "Monochrome", colors: hex(["#e0e0e0","#c0c0c0","#a0a0a0","#808080","#606060","#404040","#242424"])),
        GlyphPalette(id: 1,  name: "Dusk",       colors: hex(["#f0c080","#d87840","#b84858","#6a2888","#243080","#141850","#0c0c28"])),
        GlyphPalette(id: 2,  name: "Ember",      colors: hex(["#f8d060","#f0a030","#e06018","#c03008","#881800","#4c0a00","#200400"])),
        GlyphPalette(id: 3,  name: "Forest",     colors: hex(["#c0f0a0","#80c860","#409040","#206830","#0c5020","#063010","#021808"])),
        GlyphPalette(id: 4,  name: "Ocean",      colors: hex(["#b0d8f8","#60a8e0","#2868c0","#084898","#043070","#011840","#000820"])),
        GlyphPalette(id: 5,  name: "Aurora",     colors: hex(["#e8c8ff","#a060e8","#6020c0","#3008a8","#180470","#080128","#020014"])),
        GlyphPalette(id: 6,  name: "Sepia",      colors: hex(["#f0e0b0","#d0a860","#b07040","#804028","#502010","#28100c","#140804"])),
        GlyphPalette(id: 7,  name: "Neon City",  colors: hex(["#d8ffc0","#60f060","#00c8b8","#0060f0","#8000e0","#40006c","#140020"])),
        GlyphPalette(id: 8,  name: "Rust",       colors: hex(["#f0d890","#e09040","#c84820","#902018","#581008","#2c0804","#120200"])),
        GlyphPalette(id: 9,  name: "Mint Ice",   colors: hex(["#c8f8e4","#78e4be","#30b890","#0a8868","#065848","#023020","#011010"])),
        GlyphPalette(id: 10, name: "Candy",      colors: hex(["#ffc8e8","#ff98cc","#ff50a0","#d01878","#800848","#3c0028","#180010"])),
        GlyphPalette(id: 11, name: "Gold Ink",   colors: hex(["#f8e898","#e8c050","#c89010","#906000","#583800","#2c1c00","#140a00"]))
    ]

    private static func hex(_ hexes: [String]) -> [Color] {
        hexes.map { Color(hex: $0) }
    }

    static func palette(at index: Int) -> GlyphPalette? {
        guard index >= 0 && index < presets.count else { return nil }
        return presets[index]
    }
}

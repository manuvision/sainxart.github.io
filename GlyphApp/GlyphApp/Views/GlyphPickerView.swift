import SwiftUI

struct GlyphPickerView: View {
    @ObservedObject var appState: AppState
    let stateIndex: Int
    @Binding var isPresented: Bool

    @State private var selectedCategory: GlyphCategory = .all

    private let columns = [GridItem(.adaptive(minimum: 64), spacing: 8)]

    var filteredShapes: [GlyphShape] {
        if selectedCategory == .all {
            return GlyphShape.allCases
        }
        return GlyphShape.allCases.filter { $0.category == selectedCategory }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Category filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(GlyphCategory.allCases) { cat in
                            Button(action: {
                                HapticsManager.shared.selection()
                                selectedCategory = cat
                            }) {
                                Text(cat.rawValue)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(selectedCategory == cat
                                        ? Color(red: 0.039, green: 0.518, blue: 1.0)
                                        : Color(uiColor: .tertiarySystemFill))
                                    .foregroundColor(.white)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(Color(uiColor: .systemBackground))

                Divider()

                ScrollView {
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(filteredShapes) { shape in
                            GlyphPickerCell(
                                shape: shape,
                                isSelected: appState.glyphIDs[safe: stateIndex] == shape.rawValue,
                                color: appState.colors[safe: stateIndex] ?? .white
                            )
                            .onTapGesture {
                                HapticsManager.shared.impact(.light)
                                appState.glyphIDs[stateIndex] = shape.rawValue
                                isPresented = false
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Pick Glyph — State \(stateIndex + 1)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        HapticsManager.shared.impact(.medium)
                        isPresented = false
                    }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
        }
    }
}

struct GlyphPickerCell: View {
    let shape: GlyphShape
    let isSelected: Bool
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            GlyphPreviewShape(shape: shape, color: color)
                .frame(width: 44, height: 44)
                .padding(6)
                .background(isSelected
                    ? Color(red: 0.039, green: 0.518, blue: 1.0).opacity(0.2)
                    : Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected ? Color(red: 0.039, green: 0.518, blue: 1.0) : Color.clear, lineWidth: 2)
                )

            Text(shape.displayName)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
    }
}

// MARK: - GlyphPreviewShape

struct GlyphPreviewShape: UIViewRepresentable {
    let shape: GlyphShape
    let color: Color

    func makeUIView(context: Context) -> GlyphPreviewUIView {
        GlyphPreviewUIView(shape: shape, color: UIColor(color))
    }

    func updateUIView(_ uiView: GlyphPreviewUIView, context: Context) {
        uiView.shape = shape
        uiView.glyphColor = UIColor(color)
        uiView.setNeedsDisplay()
    }
}

class GlyphPreviewUIView: UIView {
    var shape: GlyphShape
    var glyphColor: UIColor

    init(shape: GlyphShape, color: UIColor) {
        self.shape = shape
        self.glyphColor = color
        super.init(frame: .zero)
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) { fatalError() }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        let inset: CGFloat = 3
        let drawRect = rect.insetBy(dx: inset, dy: inset)
        let instructions = GlyphPaths.drawInstructions(for: shape, in: drawRect)
        let rawStroke = GlyphPaths.strokeWidth(for: shape)
        let scaledStroke = rawStroke * (drawRect.width / 24.0)

        ctx.setFillColor(glyphColor.cgColor)
        ctx.setStrokeColor(glyphColor.cgColor)
        ctx.setLineWidth(scaledStroke)
        ctx.setLineCap(GlyphPaths.lineCap(for: shape))
        ctx.setLineJoin(.round)

        for (path, isFill) in instructions {
            ctx.addPath(path)
            if isFill {
                ctx.fillPath()
            } else {
                ctx.strokePath()
            }
        }
    }
}

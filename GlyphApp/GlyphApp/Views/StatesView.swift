import SwiftUI

struct StatesView: View {
    @ObservedObject var appState: AppState
    var imagePalette: [Color]

    @State private var showingPalettePicker = false
    @State private var glyphPickerState: Int? = nil
    @State private var showingColorPicker: Int? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {

                // Header actions
                HStack(spacing: 8) {
                    // Preset glyphs button
                    ActionButton(title: "Glyph", systemImage: "rectangle.grid.3x2") {
                        HapticsManager.shared.impact(.medium)
                        appState.glyphIDs = AppState.presetGlyphs
                    }

                    // Palette picker
                    ActionButton(systemImage: "paintpalette") {
                        HapticsManager.shared.impact(.medium)
                        showingPalettePicker = true
                    }

                    // Randomize
                    ActionButton(systemImage: "dice") {
                        HapticsManager.shared.impact(.medium)
                        appState.randomizeGlyphs()
                    }

                    // Reset
                    ActionButton(systemImage: "arrow.counterclockwise") {
                        HapticsManager.shared.impact(.medium)
                        appState.resetToDefaults()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)

                // 7 state rows
                ForEach(0..<7, id: \.self) { i in
                    StateRow(
                        index: i,
                        appState: appState,
                        onTapGlyph: { glyphPickerState = i }
                    )
                    .padding(.horizontal, 16)
                }

                Spacer(minLength: 40)
            }
            .padding(.vertical, 8)
        }
        .sheet(item: $glyphPickerState, content: { idx in
            GlyphPickerView(appState: appState, stateIndex: idx, isPresented: Binding(
                get: { glyphPickerState != nil },
                set: { if !$0 { glyphPickerState = nil } }
            ))
        })
        .sheet(isPresented: $showingPalettePicker) {
            PalettePickerView(appState: appState, imagePalette: imagePalette, isPresented: $showingPalettePicker)
        }
    }
}

// MARK: - State Row

struct StateRow: View {
    let index: Int
    @ObservedObject var appState: AppState
    let onTapGlyph: () -> Void

    @State private var showColorPicker = false

    var body: some View {
        HStack(spacing: 10) {
            // Color swatch
            Button(action: {
                HapticsManager.shared.impact(.medium)
                showColorPicker = true
            }) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(appState.colors[safe: index] ?? .white)
                    .frame(width: 36, height: 36)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }

            // State info
            VStack(alignment: .leading, spacing: 2) {
                Text(AppState.stateNames[index])
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.secondary)
                Text(AppState.stateLabels[index])
                    .font(.caption.weight(.medium))
                    .foregroundColor(.primary)
            }

            Spacer()

            // Glyph button
            Button(action: {
                HapticsManager.shared.impact(.medium)
                onTapGlyph()
            }) {
                let glyphID = appState.glyphIDs[safe: index] ?? "square"
                let shape = GlyphShape(rawValue: glyphID)
                Text(shape?.displayName ?? glyphID)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(uiColor: .tertiarySystemFill))
                    .cornerRadius(8)
                    .foregroundColor(.primary)
            }

            // Rotation button
            Button(action: {
                HapticsManager.shared.impact(.light)
                let current = appState.stateRotations[safe: index] ?? 0
                let next = (current + 90) % 360
                appState.stateRotations[index] = next
            }) {
                let rot = appState.stateRotations[safe: index] ?? 0
                Text("\(rot)°")
                    .font(.caption.monospacedDigit())
                    .frame(width: 38)
                    .padding(.vertical, 6)
                    .background(Color(uiColor: .tertiarySystemFill))
                    .cornerRadius(8)
                    .foregroundColor(.secondary)
            }
        }
        .padding(10)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
        .sheet(isPresented: $showColorPicker) {
            ColorPickerSheet(color: Binding(
                get: { appState.colors[safe: index] ?? .white },
                set: { appState.colors[index] = $0 }
            ), isPresented: $showColorPicker)
        }
    }
}

// MARK: - Color Picker Sheet

struct ColorPickerSheet: View {
    @Binding var color: Color
    @Binding var isPresented: Bool

    var body: some View {
        NavigationView {
            VStack {
                ColorPicker("Choose Color", selection: $color, supportsOpacity: false)
                    .padding(24)
                    .onChange(of: color) { _ in
                        HapticsManager.shared.selection()
                    }
                Spacer()
            }
            .navigationTitle("State Color")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        HapticsManager.shared.impact(.medium)
                        isPresented = false
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Action Button

struct ActionButton: View {
    var title: String? = nil
    var systemImage: String? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let img = systemImage {
                    Image(systemName: img)
                        .font(.system(size: 14))
                }
                if let t = title {
                    Text(t)
                        .font(.caption.weight(.semibold))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(uiColor: .secondarySystemBackground))
            .cornerRadius(8)
            .foregroundColor(.primary)
        }
    }
}

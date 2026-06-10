import SwiftUI

struct PalettePickerView: View {
    @ObservedObject var appState: AppState
    var imagePalette: [Color]
    @Binding var isPresented: Bool

    var body: some View {
        NavigationView {
            List {
                // Image palette
                Section(header: Text("FROM IMAGE")) {
                    PaletteRow(
                        name: "Image Colors",
                        colors: imagePalette.isEmpty
                            ? Array(repeating: Color.gray, count: 7)
                            : imagePalette,
                        isSelected: appState.palSelected == -1,
                        isDisabled: imagePalette.isEmpty
                    )
                    .onTapGesture {
                        guard !imagePalette.isEmpty else { return }
                        HapticsManager.shared.impact(.medium)
                        appState.palSelected = -1
                        appState.applyPalette(appState.palReversed ? imagePalette.reversed() : imagePalette)
                        isPresented = false
                    }
                }

                // Preset palettes
                Section(header: Text("PRESETS")) {
                    ForEach(Palettes.presets) { palette in
                        PaletteRow(
                            name: palette.name,
                            colors: appState.palReversed ? palette.colors.reversed() : palette.colors,
                            isSelected: appState.palSelected == palette.id,
                            isDisabled: false
                        )
                        .onTapGesture {
                            HapticsManager.shared.impact(.medium)
                            appState.palSelected = palette.id
                            appState.applyPalette(appState.palReversed ? palette.colors.reversed() : palette.colors)
                            isPresented = false
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Palette")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Toggle(isOn: $appState.palReversed) {
                        Text("Reverse")
                            .font(.caption)
                    }
                    .toggleStyle(.button)
                    .onChange(of: appState.palReversed) { _ in
                        HapticsManager.shared.impact(.light)
                        reapplyCurrentPalette()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        HapticsManager.shared.impact(.medium)
                        isPresented = false
                    }
                }
            }
        }
    }

    private func reapplyCurrentPalette() {
        guard let sel = appState.palSelected else { return }
        if sel == -1 {
            appState.applyPalette(appState.palReversed ? imagePalette.reversed() : imagePalette)
        } else if let palette = Palettes.palette(at: sel) {
            appState.applyPalette(appState.palReversed ? palette.colors.reversed() : palette.colors)
        }
    }
}

struct PaletteRow: View {
    let name: String
    let colors: [Color]
    let isSelected: Bool
    let isDisabled: Bool

    var body: some View {
        HStack(spacing: 8) {
            // Color strip
            HStack(spacing: 2) {
                ForEach(0..<min(7, colors.count), id: \.self) { i in
                    Rectangle()
                        .fill(colors[i])
                        .frame(width: 24, height: 28)
                        .cornerRadius(3)
                }
            }

            Text(name)
                .font(.body)
                .foregroundColor(isDisabled ? .secondary : .primary)

            Spacer()

            if isSelected {
                Image(systemName: "checkmark")
                    .foregroundColor(Color(red: 0.039, green: 0.518, blue: 1.0))
                    .font(.body.weight(.semibold))
            }
        }
        .padding(.vertical, 4)
        .opacity(isDisabled ? 0.4 : 1.0)
    }
}

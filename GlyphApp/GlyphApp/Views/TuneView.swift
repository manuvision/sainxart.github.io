import SwiftUI

struct TuneView: View {
    @ObservedObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {

                // Grid
                SectionCard {
                    LabeledSlider(
                        label: "Grid",
                        value: Binding(
                            get: { Double(appState.grid) },
                            set: { appState.grid = Int($0) }
                        ),
                        range: 4...80,
                        step: 1,
                        displayValue: "\(appState.grid)"
                    )

                    Divider()

                    ToggleRow(label: "Animate Grid", isOn: $appState.gridAnim)

                    if appState.gridAnim {
                        LabeledSlider(
                            label: "Anim Speed",
                            value: $appState.gridAnimSpeed,
                            range: 0.001...0.3,
                            step: 0.001,
                            displayValue: String(format: "%.3f", appState.gridAnimSpeed)
                        )
                    }
                }

                // Background & Fill
                SectionCard {
                    HStack {
                        Text("Background")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Spacer()
                        ColorPicker("", selection: $appState.bgColor, supportsOpacity: false)
                            .labelsHidden()
                            .onChange(of: appState.bgColor) { _ in
                                HapticsManager.shared.selection()
                            }
                    }

                    Divider()

                    ToggleRow(label: "Fill Shapes", isOn: $appState.fillSolid)
                    ToggleRow(label: "Invert Mapping", isOn: $appState.invertMap)
                }

                // Scale
                SectionCard {
                    LabeledSlider(
                        label: "Scale Min",
                        value: $appState.scaleMin,
                        range: 0...1,
                        step: 0.01,
                        displayValue: String(format: "%.2f", appState.scaleMin)
                    )

                    Divider()

                    LabeledSlider(
                        label: "Scale Max",
                        value: $appState.scaleMax,
                        range: 0.1...2,
                        step: 0.01,
                        displayValue: String(format: "%.2f", appState.scaleMax)
                    )
                }

                // Depth
                SectionCard {
                    LabeledSlider(
                        label: "Depth Spread",
                        value: $appState.depthSpread,
                        range: 0...200,
                        step: 1,
                        displayValue: String(format: "%.0f", appState.depthSpread)
                    )

                    Divider()

                    ToggleRow(label: "Invert Depth", isOn: $appState.depthInvert)
                    ToggleRow(label: "Depth Rotation", isOn: $appState.depthAnim)
                }

                // Auto Randomize
                SectionCard {
                    ToggleRow(label: "Auto Randomize", isOn: $appState.autoRandom)

                    if appState.autoRandom {
                        Divider()

                        LabeledSlider(
                            label: "Flicker Speed",
                            value: $appState.flickerSpeed,
                            range: 1...60,
                            step: 0.5,
                            displayValue: String(format: "%.1f", appState.flickerSpeed)
                        )

                        Divider()

                        ToggleRow(label: "Varied Rhythms", isOn: $appState.variedRhythm)
                    }
                }

                // Aspect Ratio
                SectionCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Aspect Ratio")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Picker("Aspect Ratio", selection: $appState.aspectRatio) {
                            ForEach(AspectRatio.allCases) { ar in
                                Text(ar.rawValue).tag(ar)
                            }
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: appState.aspectRatio) { _ in
                            HapticsManager.shared.selection()
                        }
                    }
                }

                Spacer(minLength: 40)
            }
            .padding(16)
        }
    }
}

// MARK: - Reusable Components

struct SectionCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 12) {
            content
        }
        .padding(14)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct LabeledSlider: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let displayValue: String

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(label)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Spacer()
                Text(displayValue)
                    .font(.subheadline.monospacedDigit())
                    .foregroundColor(.primary)
            }
            Slider(value: $value, in: range, step: step)
                .accentColor(Color(red: 0.039, green: 0.518, blue: 1.0))
                .onChange(of: value) { _ in
                    HapticsManager.shared.selection()
                }
        }
    }
}

struct ToggleRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
            Spacer()
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .onChange(of: isOn) { _ in
                    HapticsManager.shared.impact(.light)
                }
        }
    }
}

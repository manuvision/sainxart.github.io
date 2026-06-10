import SwiftUI

struct ControlsSheet: View {
    @ObservedObject var appState: AppState
    var imagePalette: [Color]
    var onExport: () -> Void

    @State private var selectedTab: Int = 0
    @State private var sheetHeight: CGFloat = 320
    @State private var dragOffset: CGFloat = 0
    let minHeight: CGFloat = 80
    let maxHeight: CGFloat = UIScreen.main.bounds.height * 0.75

    var body: some View {
        VStack(spacing: 0) {
            // Drag indicator
            Capsule()
                .fill(Color(uiColor: .systemFill))
                .frame(width: 36, height: 5)
                .padding(.top, 10)
                .padding(.bottom, 6)

            // Tab bar
            HStack(spacing: 0) {
                ForEach(["Tune", "States", "Export"], id: \.self) { tab in
                    let idx = ["Tune", "States", "Export"].firstIndex(of: tab) ?? 0
                    Button(action: {
                        HapticsManager.shared.selection()
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            selectedTab = idx
                        }
                    }) {
                        Text(tab)
                            .font(.subheadline.weight(selectedTab == idx ? .semibold : .regular))
                            .foregroundColor(selectedTab == idx ? .white : .secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(
                                selectedTab == idx
                                    ? Color(red: 0.039, green: 0.518, blue: 1.0)
                                    : Color.clear
                            )
                            .cornerRadius(8)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)

            Divider()

            // Tab content
            Group {
                switch selectedTab {
                case 0:
                    TuneView(appState: appState)
                case 1:
                    StatesView(appState: appState, imagePalette: imagePalette)
                case 2:
                    ExportView(appState: appState, onExport: onExport)
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(height: max(minHeight, min(maxHeight, sheetHeight + dragOffset)))
        .background(
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.3), radius: 20, y: -5)
        .gesture(
            DragGesture()
                .onChanged { value in
                    dragOffset = -value.translation.height
                }
                .onEnded { value in
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        sheetHeight = max(minHeight, min(maxHeight, sheetHeight + dragOffset))
                        dragOffset = 0
                    }
                }
        )
    }
}

// MARK: - Export View

struct ExportView: View {
    @ObservedObject var appState: AppState
    var onExport: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SectionCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Export")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.secondary)

                        Button(action: {
                            HapticsManager.shared.impact(.medium)
                            onExport()
                        }) {
                            Label("Save to Photos", systemImage: "square.and.arrow.down")
                                .font(.body.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color(red: 0.039, green: 0.518, blue: 1.0))
                                .cornerRadius(12)
                        }
                    }
                }
                .padding(.horizontal, 16)

                Spacer(minLength: 40)
            }
            .padding(.vertical, 16)
        }
    }
}

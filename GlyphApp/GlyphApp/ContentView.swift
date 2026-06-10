import SwiftUI
import PhotosUI
import Photos

struct ContentView: View {
    @StateObject var appState = AppState()
    @StateObject var cameraManager = CameraManager()

    @State private var imagePalette: [Color] = []
    @State private var selectedPhotoItem: PhotosPickerItem? = nil
    @State private var staticImage: CGImage? = nil
    @State private var useCameraInput: Bool = true
    @State private var showSaveSuccess = false
    @State private var showSaveError = false

    // Depth tilt tracking
    @State private var depthRotX: Double = 0
    @State private var depthRotY: Double = 0

    private var sourceImage: CGImage? {
        useCameraInput ? cameraManager.currentFrame : staticImage
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // Canvas fills entire screen
                Color.black.ignoresSafeArea()

                CanvasRepresentable(
                    appState: appState,
                    sourceImage: sourceImage,
                    depthRotX: depthRotX,
                    depthRotY: depthRotY
                )
                .ignoresSafeArea()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Camera/Photo toggle + controls overlay
                VStack {
                    // Top toolbar
                    HStack {
                        // App title
                        Text("GLYPH")
                            .font(.system(size: 14, weight: .black, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))

                        Spacer()

                        // Photo picker
                        PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                            Image(systemName: "photo")
                                .toolbarButtonStyle()
                        }
                        .onChange(of: selectedPhotoItem) { item in
                            loadPhoto(item)
                        }

                        // Camera toggle
                        Button(action: {
                            HapticsManager.shared.impact(.medium)
                            if useCameraInput {
                                cameraManager.toggleCamera()
                            }
                        }) {
                            Image(systemName: useCameraInput ? "arrow.triangle.2.circlepath.camera" : "camera")
                                .toolbarButtonStyle()
                        }

                        // Camera / Photo mode toggle
                        Button(action: {
                            HapticsManager.shared.impact(.medium)
                            useCameraInput.toggle()
                            if useCameraInput {
                                cameraManager.startSession()
                            } else {
                                cameraManager.stopSession()
                            }
                        }) {
                            Image(systemName: useCameraInput ? "camera.fill" : "photo.fill")
                                .toolbarButtonStyle(active: useCameraInput)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, geo.safeAreaInsets.top + 8)

                    Spacer()
                }

                // Controls sheet at bottom
                ControlsSheet(
                    appState: appState,
                    imagePalette: imagePalette,
                    onExport: exportImage
                )
                .frame(maxWidth: .infinity)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if useCameraInput {
                cameraManager.startSession()
            }
        }
        .onDisappear {
            cameraManager.stopSession()
        }
        .onChange(of: sourceImage) { img in
            if let img = img {
                let palette = ImageUtils.extractPalette(from: img)
                if !palette.isEmpty {
                    imagePalette = palette
                }
            }
        }
        .alert("Saved!", isPresented: $showSaveSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your artwork has been saved to Photos.")
        }
        .alert("Save Failed", isPresented: $showSaveError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Could not save to Photos. Please check permissions.")
        }
    }

    // MARK: - Load Photo

    private func loadPhoto(_ item: PhotosPickerItem?) {
        guard let item = item else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data),
               let cgImage = uiImage.cgImage {
                await MainActor.run {
                    staticImage = cgImage
                    useCameraInput = false
                    cameraManager.stopSession()
                    let palette = ImageUtils.extractPalette(from: cgImage)
                    if !palette.isEmpty {
                        imagePalette = palette
                    }
                }
            }
        }
    }

    // MARK: - Export

    private func exportImage() {
        guard let source = sourceImage else { return }
        let size = CGSize(width: UIScreen.main.bounds.width * UIScreen.main.scale,
                         height: UIScreen.main.bounds.height * UIScreen.main.scale)

        let params = RenderParams(
            grid: appState.grid,
            fillSolid: appState.fillSolid,
            invertMap: appState.invertMap,
            scaleMin: appState.scaleMin,
            scaleMax: appState.scaleMax,
            depth: DepthParams(
                spread: appState.depthSpread,
                invert: appState.depthInvert,
                rotX: depthRotX,
                rotY: depthRotY
            ),
            colors: appState.colors.map { UIColor($0) },
            glyphIDs: appState.glyphIDs,
            stateRotations: appState.stateRotations,
            bgColor: UIColor(appState.bgColor)
        )

        guard let rendered = GlyphRenderer.renderToImage(source: source, canvasSize: size, params: params) else {
            showSaveError = true
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            if status == .authorized || status == .limited {
                PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.creationRequestForAsset(from: rendered)
                } completionHandler: { success, _ in
                    DispatchQueue.main.async {
                        if success {
                            HapticsManager.shared.notification(.success)
                            showSaveSuccess = true
                        } else {
                            showSaveError = true
                        }
                    }
                }
            } else {
                DispatchQueue.main.async { showSaveError = true }
            }
        }
    }
}

// MARK: - Toolbar Button Style

extension Image {
    func toolbarButtonStyle(active: Bool = false) -> some View {
        self
            .font(.system(size: 18))
            .foregroundColor(active ? Color(red: 0.039, green: 0.518, blue: 1.0) : .white)
            .frame(width: 40, height: 40)
            .background(Color.white.opacity(0.1))
            .clipShape(Circle())
    }
}

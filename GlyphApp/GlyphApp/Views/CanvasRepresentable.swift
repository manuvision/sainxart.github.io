import SwiftUI
import UIKit

// MARK: - GlyphCanvasView (UIKit)

class GlyphCanvasView: UIView {
    var appState: AppState?
    var sourceImage: CGImage?
    var depthRotX: Double = 0
    var depthRotY: Double = 0

    private var displayLink: CADisplayLink?
    private var animPhase: Double = 0
    private var lastAnimTime: Double = 0
    private var flickerTimers: [Double] = Array(repeating: 0, count: 7)
    private var flickerStates: [String] = []
    private var currentGlyphIDs: [String] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        isOpaque = true
        setupDisplayLink()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func setupDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(tick))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }

    func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func tick() {
        guard let state = appState else { return }
        let now = displayLink?.timestamp ?? 0

        // Grid animation
        if state.gridAnim {
            animPhase += state.gridAnimSpeed
        }

        // Auto-randomize (flicker)
        if state.autoRandom {
            if currentGlyphIDs.isEmpty {
                currentGlyphIDs = state.glyphIDs
            }
            let dt = now - lastAnimTime
            lastAnimTime = now
            let baseInterval = 1.0 / state.flickerSpeed

            for i in 0..<7 {
                flickerTimers[i] -= dt
                if flickerTimers[i] <= 0 {
                    let interval = state.variedRhythm
                        ? baseInterval * Double.random(in: 0.5...2.0)
                        : baseInterval
                    flickerTimers[i] = interval

                    let allIDs = GlyphShape.allCases.map { $0.rawValue }
                    currentGlyphIDs[i] = allIDs.randomElement() ?? state.glyphIDs[i]
                    HapticsManager.shared.impact(.rigid)
                }
            }
        } else {
            currentGlyphIDs = state.glyphIDs
        }

        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext(),
              let state = appState,
              let source = sourceImage else {
            UIColor.black.setFill()
            UIRectFill(rect)
            return
        }

        let glyphs = currentGlyphIDs.isEmpty ? state.glyphIDs : currentGlyphIDs

        let params = RenderParams(
            grid: state.grid,
            fillSolid: state.fillSolid,
            invertMap: state.invertMap,
            scaleMin: state.scaleMin,
            scaleMax: state.scaleMax,
            depth: DepthParams(
                spread: state.depthSpread,
                invert: state.depthInvert,
                rotX: depthRotX,
                rotY: depthRotY
            ),
            colors: state.colors.map { UIColor($0) },
            glyphIDs: glyphs,
            stateRotations: state.stateRotations,
            bgColor: UIColor(state.bgColor)
        )

        GlyphRenderer.render(image: source, in: ctx, canvasSize: rect.size, params: params)
    }
}

// MARK: - SwiftUI Wrapper

struct CanvasRepresentable: UIViewRepresentable {
    @ObservedObject var appState: AppState
    var sourceImage: CGImage?
    var depthRotX: Double = 0
    var depthRotY: Double = 0

    func makeUIView(context: Context) -> GlyphCanvasView {
        let view = GlyphCanvasView()
        view.appState = appState
        view.sourceImage = sourceImage
        view.depthRotX = depthRotX
        view.depthRotY = depthRotY
        return view
    }

    func updateUIView(_ uiView: GlyphCanvasView, context: Context) {
        uiView.appState = appState
        uiView.sourceImage = sourceImage
        uiView.depthRotX = depthRotX
        uiView.depthRotY = depthRotY
    }

    static func dismantleUIView(_ uiView: GlyphCanvasView, coordinator: ()) {
        uiView.stopDisplayLink()
    }
}

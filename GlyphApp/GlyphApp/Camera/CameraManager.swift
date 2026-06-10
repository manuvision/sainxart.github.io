import AVFoundation
import UIKit
import CoreVideo

class CameraManager: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {

    @Published var currentFrame: CGImage?
    @Published var permissionGranted: Bool = false
    @Published var isRunning: Bool = false
    @Published var useFrontCamera: Bool = false

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private let sessionQueue = DispatchQueue(label: "com.glyph.cameraSession", qos: .userInitiated)
    private let frameQueue = DispatchQueue(label: "com.glyph.frameProcessing", qos: .userInitiated)

    override init() {
        super.init()
        checkPermission()
    }

    // MARK: - Permission

    func checkPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            DispatchQueue.main.async { self.permissionGranted = true }
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    self?.permissionGranted = granted
                    if granted { self?.configureSession() }
                }
            }
        default:
            DispatchQueue.main.async { self.permissionGranted = false }
        }
    }

    // MARK: - Session Setup

    private func configureSession(front: Bool? = nil) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            let useFront = front ?? self.useFrontCamera
            let session = AVCaptureSession()
            session.beginConfiguration()
            session.sessionPreset = .hd1280x720

            // Camera input
            let position: AVCaptureDevice.Position = useFront ? .front : .back
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
                  let input = try? AVCaptureDeviceInput(device: device),
                  session.canAddInput(input) else {
                return
            }
            session.addInput(input)

            // Video output
            let output = AVCaptureVideoDataOutput()
            output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
            output.alwaysDiscardsLateVideoFrames = true
            output.setSampleBufferDelegate(self, queue: self.frameQueue)

            guard session.canAddOutput(output) else { return }
            session.addOutput(output)

            // Set orientation
            if let connection = output.connection(with: .video) {
                if connection.isVideoOrientationSupported {
                    connection.videoOrientation = .portrait
                }
                if useFront && connection.isVideoMirroringSupported {
                    connection.isVideoMirrored = true
                }
            }

            session.commitConfiguration()
            self.captureSession = session
            self.videoOutput = output

            session.startRunning()
            DispatchQueue.main.async {
                self.isRunning = session.isRunning
            }
        }
    }

    // MARK: - Controls

    func startSession() {
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession, !session.isRunning else { return }
            session.startRunning()
            DispatchQueue.main.async { self.isRunning = true }
        }
    }

    func stopSession() {
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession, session.isRunning else { return }
            session.stopRunning()
            DispatchQueue.main.async { self.isRunning = false }
        }
    }

    func toggleCamera() {
        let newFront = !useFrontCamera
        DispatchQueue.main.async { self.useFrontCamera = newFront }

        // Reconfigure with opposite camera
        sessionQueue.async { [weak self] in
            self?.captureSession?.stopRunning()
            self?.captureSession = nil
            self?.configureSession(front: newFront)
        }
    }

    // MARK: - Frame Delegate

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let cgImage = ImageUtils.cgImage(from: pixelBuffer)
        DispatchQueue.main.async { [weak self] in
            self?.currentFrame = cgImage
        }
    }
}

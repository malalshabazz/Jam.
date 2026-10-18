import AVFoundation
import ExpoModulesCore

public class JamWaveformModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JamWaveform")

    AsyncFunction("getPeaks") { (uri: String, bucketCount: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let peaks = try JamWaveformModule.extractPeaks(uri: uri, bucketCount: bucketCount)
          promise.resolve(peaks)
        } catch {
          promise.reject(error)
        }
      }
    }
  }

  private static func extractPeaks(uri: String, bucketCount: Int) throws -> [Double] {
    let count = max(1, bucketCount)
    let url: URL
    if uri.hasPrefix("file://"), let parsed = URL(string: uri) {
      url = parsed
    } else {
      url = URL(fileURLWithPath: uri)
    }

    let asset = AVURLAsset(url: url)
    let audioTracks = asset.tracks(withMediaType: .audio)
    guard let track = audioTracks.first else {
      throw WaveformException("no audio track")
    }

    let durationSeconds = CMTimeGetSeconds(asset.duration)
    guard durationSeconds.isFinite, durationSeconds > 0 else {
      throw WaveformException("invalid audio duration")
    }

    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsNonInterleaved: false,
      AVNumberOfChannelsKey: 1,
    ]

    let reader: AVAssetReader
    do {
      reader = try AVAssetReader(asset: asset)
    } catch {
      throw WaveformException("failed to open audio reader: \(error.localizedDescription)")
    }

    let output = AVAssetReaderTrackOutput(track: track, outputSettings: outputSettings)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else {
      throw WaveformException("failed to attach audio reader output")
    }
    reader.add(output)

    guard reader.startReading() else {
      throw WaveformException(reader.error?.localizedDescription ?? "failed to start audio reader")
    }

    var peaks = [Double](repeating: 0, count: count)
    var sampleCount = 0

    while reader.status == .reading {
      guard let sampleBuffer = output.copyNextSampleBuffer() else { break }
      defer { CMSampleBufferInvalidate(sampleBuffer) }

      guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
      let length = CMBlockBufferGetDataLength(blockBuffer)
      if length < 2 { continue }

      let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
      let bufferStartSec = CMTimeGetSeconds(pts)
      let numSamples = length / MemoryLayout<Int16>.size
      let frameDuration = CMSampleBufferGetDuration(sampleBuffer)
      let bufferDurationSec = CMTimeGetSeconds(frameDuration)
      let secondsPerSample =
        (bufferDurationSec.isFinite && bufferDurationSec > 0 && numSamples > 0)
          ? bufferDurationSec / Double(numSamples)
          : 0

      var data = Data(count: length)
      let copyStatus = data.withUnsafeMutableBytes { rawBuffer -> OSStatus in
        guard let base = rawBuffer.baseAddress else { return -1 }
        return CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: length, destination: base)
      }
      if copyStatus != kCMBlockBufferNoErr { continue }

      data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
        let samples = rawBuffer.bindMemory(to: Int16.self)
        let limit = min(numSamples, samples.count)
        for i in 0..<limit {
          let absolute = abs(Double(samples[i]) / Double(Int16.max))
          let sampleTime =
            bufferStartSec.isFinite
              ? bufferStartSec + (secondsPerSample * Double(i))
              : 0
          let ratio = min(1, max(0, sampleTime / durationSeconds))
          let bucket = min(count - 1, Int(ratio * Double(count)))
          if absolute > peaks[bucket] {
            peaks[bucket] = absolute
          }
          sampleCount += 1
        }
      }
    }

    if reader.status == .failed {
      throw WaveformException(reader.error?.localizedDescription ?? "audio read failed")
    }

    if sampleCount == 0 {
      throw WaveformException("no audio samples")
    }

    let maxPeak = peaks.max() ?? 0
    guard maxPeak > 0 else {
      return [Double](repeating: 0, count: count)
    }
    return peaks.map { $0 / maxPeak }
  }
}

private final class WaveformException: GenericException<String> {
  override var reason: String {
    param
  }
}

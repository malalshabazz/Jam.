package expo.modules.jamwaveform

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JamWaveformModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JamWaveform")

    AsyncFunction("getPeaks") { _: String, _: Int ->
      throw CodedException("unsupported")
    }
  }
}

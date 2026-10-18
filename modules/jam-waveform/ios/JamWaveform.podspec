Pod::Spec.new do |s|
  s.name           = 'JamWaveform'
  s.version        = '0.1.0'
  s.summary        = 'Audio waveform peak extraction for Jam create trim'
  s.description    = 'Reads audio peaks from local media URIs for waveform UI'
  s.author         = 'Jam'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.frameworks = 'AVFoundation'
end

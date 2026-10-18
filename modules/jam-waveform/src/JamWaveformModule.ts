import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class JamWaveformModule extends NativeModule {
  getPeaks(uri: string, bucketCount: number): Promise<number[]>;
}

export default requireOptionalNativeModule<JamWaveformModule>('JamWaveform');

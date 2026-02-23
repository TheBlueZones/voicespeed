// AudioWorklet 处理器：采集麦克风 PCM 16kHz 16bit 单声道
// 此文件需要作为独立 JS 加载，不经过 bundler

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0];
    // Float32 (-1 ~ 1) 转 Int16 PCM
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);

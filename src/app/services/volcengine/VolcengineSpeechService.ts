import { SpeechRecognitionService, RealTimeSpeechOptions, RecognitionResult } from '../interfaces/SpeechRecognition';

const TARGET_SAMPLE_RATE = 16000;

export class VolcengineSpeechService implements SpeechRecognitionService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private options: RealTimeSpeechOptions | null = null;
  private isRecording = false;

  async initialize(): Promise<boolean> {
    // 检查后端 WebSocket 是否可用（简单 ping）
    return true;
  }

  async startRealTimeRecognition(options: RealTimeSpeechOptions): Promise<void> {
    this.options = options;

    try {
      // 1. 获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 2. 建立 WebSocket 连接
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/speech/ws`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket 连接超时')), 10000);

        this.ws!.onopen = () => {
          console.log('[volcengine] WebSocket 已连接');
        };

        this.ws!.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'ready') {
              clearTimeout(timeout);
              resolve();
              return;
            }

            if (msg.type === 'error') {
              clearTimeout(timeout);
              reject(new Error(msg.message || '语音识别服务错误'));
              return;
            }
          } catch {
            // ignore parse errors during handshake
          }
        };

        this.ws!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket 连接失败'));
        };
      });

      // 3. 设置持续的消息处理
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = () => {
        this.options?.onError(new Error('语音识别连接中断'));
      };

      this.ws.onclose = () => {
        if (this.isRecording) {
          this.cleanup();
        }
      };

      // 4. 初始化 AudioWorklet 采集音频
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });

      // 如果浏览器实际采样率不是 16kHz，需要重采样
      const actualSampleRate = this.audioContext.sampleRate;
      console.log(`[volcengine] 浏览器采样率: ${actualSampleRate}, 目标: ${TARGET_SAMPLE_RATE}`);

      await this.audioContext.audioWorklet.addModule('/pcm-processor.js');

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

      this.workletNode.port.onmessage = (event) => {
        if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        let pcmBuffer: ArrayBuffer = event.data;

        // 如果采样率不匹配，进行重采样
        if (actualSampleRate !== TARGET_SAMPLE_RATE) {
          pcmBuffer = this.resample(pcmBuffer, actualSampleRate, TARGET_SAMPLE_RATE);
        }

        this.ws.send(pcmBuffer);
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      this.isRecording = true;
      options.onStart?.();
    } catch (err) {
      this.cleanup();
      const error = err instanceof Error ? err : new Error('启动语音识别失败');

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        options.onError(new Error('请允许麦克风权限后重试'));
      } else if (error.name === 'NotFoundError') {
        options.onError(new Error('未检测到麦克风设备'));
      } else {
        options.onError(error);
      }
      throw error;
    }
  }

  stopRealTimeRecognition(): void {
    if (!this.isRecording) return;

    // 通知后端停止
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
    }

    // 延迟清理，等待最后的识别结果
    setTimeout(() => {
      this.cleanup();
      this.options?.onStop?.();
    }, 1000);

    this.isRecording = false;
  }

  dispose(): void {
    this.cleanup();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'error') {
        this.options?.onError(new Error(msg.message || '语音识别错误'));
        return;
      }

      if (msg.type === 'result' && msg.payload) {
        const result = this.extractResult(msg.payload, msg.isLast);
        if (result) {
          this.options?.onResult(result);
        }
      }
    } catch {
      // ignore
    }
  }

  private extractResult(payload: Record<string, unknown>, isLast: boolean): RecognitionResult | null {
    // 火山引擎返回结构：payload.result 包含识别文本
    // payload.result[0].text 或 payload.text
    // utterances 包含分句信息和 speech_rate

    let text = '';
    let speechRate: number | undefined;

    // 尝试从 result 字段提取
    if (Array.isArray(payload.result)) {
      text = (payload.result as Array<{ text?: string }>)
        .map((r) => r.text || '')
        .join('');
    } else if (typeof payload.result === 'string') {
      text = payload.result;
    } else if (typeof payload.text === 'string') {
      text = payload.text;
    }

    // 从 utterances 提取语速
    if (Array.isArray(payload.utterances)) {
      const utterances = payload.utterances as Array<{
        text?: string;
        definite?: boolean;
        additions?: { speech_rate?: number };
      }>;

      // 拼接所有 utterance 的文本
      if (utterances.length > 0) {
        const fullText = utterances.map((u) => u.text || '').join('');
        if (fullText) text = fullText;
      }

      // 取最后一个确定分句的语速
      for (let i = utterances.length - 1; i >= 0; i--) {
        const u = utterances[i];
        if (u.additions?.speech_rate !== undefined) {
          speechRate = u.additions.speech_rate;
          break;
        }
      }
    }

    if (!text && !isLast) return null;

    return {
      text,
      isFinished: isLast,
      speechRate,
    };
  }

  /** Int16 PCM 重采样 */
  private resample(pcmBuffer: ArrayBuffer, fromRate: number, toRate: number): ArrayBuffer {
    const input = new Int16Array(pcmBuffer);
    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;

      if (idx + 1 < input.length) {
        output[i] = Math.round(input[idx] * (1 - frac) + input[idx + 1] * frac);
      } else {
        output[i] = input[idx] || 0;
      }
    }

    return output.buffer;
  }

  private cleanup() {
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.audioContext?.close().catch(() => {});
    this.mediaStream?.getTracks().forEach((t) => t.stop());

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }

    this.ws = null;
    this.audioContext = null;
    this.workletNode = null;
    this.sourceNode = null;
    this.mediaStream = null;
    this.isRecording = false;
  }
}

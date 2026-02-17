import { SpeechRecognitionService, RealTimeSpeechOptions } from '../interfaces/SpeechRecognition';

const MOCK_SENTENCES = [
  '今天天气真不错',
  '我正在测试语速监测功能',
  '这是一个模拟的语音识别结果',
  '希望这个功能能够正常工作',
  '语速监测可以帮助我们了解说话的速度',
  '快速说话的时候语速会变高',
  '慢慢说话的时候语速会降低',
  '这个系统会实时计算每分钟的字数',
];

export class MockSpeechRecognitionService implements SpeechRecognitionService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private options: RealTimeSpeechOptions | null = null;
  private sentenceIndex = 0;
  private accumulatedText = '';

  async initialize(): Promise<boolean> {
    const res = await fetch('/api/speech/token', { method: 'POST' });
    return res.ok;
  }

  async startRealTimeRecognition(options: RealTimeSpeechOptions): Promise<void> {
    this.options = options;
    this.sentenceIndex = 0;
    this.accumulatedText = '';

    options.onStart?.();

    this.intervalId = setInterval(() => {
      if (!this.options) return;

      const sentence = MOCK_SENTENCES[this.sentenceIndex % MOCK_SENTENCES.length];
      this.accumulatedText += (this.accumulatedText ? '，' : '') + sentence;
      this.sentenceIndex++;

      this.options.onResult({
        text: this.accumulatedText,
        isFinished: false,
      });
    }, 1500);
  }

  stopRealTimeRecognition(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.options && this.accumulatedText) {
      this.options.onResult({
        text: this.accumulatedText,
        isFinished: true,
      });
    }
    this.options?.onStop?.();
    this.options = null;
  }

  dispose(): void {
    this.stopRealTimeRecognition();
  }
}

// 语音识别服务接口定义

// 识别结果
export interface RecognitionResult {
  text: string;
  isFinished: boolean;
}

// 实时语音识别选项
export interface RealTimeSpeechOptions {
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
}

// 语音识别服务接口
export interface SpeechRecognitionService {
  initialize(): Promise<boolean>;
  startRealTimeRecognition(options: RealTimeSpeechOptions): Promise<void>;
  stopRealTimeRecognition(): void;
  dispose(): void;
}

// 语音识别服务接口定义

// 识别结果类型
export interface RecognitionResult {
  text: string;
  isFinished: boolean;
  rawResponse?: unknown;
}

// 语音识别服务配置
export interface SpeechRecognitionConfig {
  appId: string;
  apiKey: string;
  apiSecret?: string;
  language?: string;
  sampleRate?: number;
  // 其他可能的配置项
  [key: string]: string | number | boolean | undefined;
}

// 实时语音识别选项
export interface RealTimeSpeechOptions {
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
}

// 文件语音识别选项
export interface FileSpeechOptions {
  file: File;
  onResult: (result: RecognitionResult) => void;
  onError: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
  onProgress?: (progress: number) => void;
}

// 语音识别服务接口
export interface SpeechRecognitionService {
  // 初始化服务
  initialize(config: SpeechRecognitionConfig): Promise<boolean>;
  
  // 开始实时语音识别
  startRealTimeRecognition(options: RealTimeSpeechOptions): Promise<void>;
  
  // 停止实时语音识别
  stopRealTimeRecognition(): void;
  
  // 开始文件语音识别
  recognizeFile(options: FileSpeechOptions): Promise<void>;
  
  // 取消正在进行的识别
  cancel(): void;
  
  // 释放资源
  dispose(): void;
}

// 语音识别工厂 - 用于创建不同厂商的语音识别服务
export interface SpeechRecognitionFactory {
  createService(vendor: string): SpeechRecognitionService;
} 
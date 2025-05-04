'use client';

import {
  SpeechRecognitionService,
  SpeechRecognitionConfig,
  RealTimeSpeechOptions,
  FileSpeechOptions,
  RecognitionResult
} from '../../interfaces/SpeechRecognition';

// 添加RecorderManager类型定义
interface RecorderManager {
  start(options: { sampleRate: number; frameSize: number }): void;
  stop(): void;
  onFrameRecorded?: (data: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => void;
  onStop?: (audioBuffers: ArrayBuffer[]) => void;
}

// 将CryptoJS类型定义
interface CryptoJSStatic {
  HmacSHA256(message: string, secret: string): CryptoJSWordArray;
  enc: {
    Base64: {
      stringify(wordArray: CryptoJSWordArray): string;
    }
  }
}

// 用于表示CryptoJS的WordArray类型
interface CryptoJSWordArray {
  words: number[];
  sigBytes: number;
}

declare global {
  interface Window {
    RecorderManager: new (path: string) => RecorderManager;
    CryptoJS: CryptoJSStatic;
  }
}

export class XunfeiSpeechRecognition implements SpeechRecognitionService {
  private config: SpeechRecognitionConfig | null = null;
  private wsInstance: WebSocket | null = null;
  private recorderInstance: RecorderManager | null = null;
  private scriptLoaded: boolean = false;
  private tempText: string = '';
  private finalText: string = '';
  private isProcessing: boolean = false;

  // 添加默认配置选项
  private defaultConfig: SpeechRecognitionConfig = {
    appId: process.env.NEXT_PUBLIC_XUNFEI_APPID || '您的讯飞AppID',
    apiKey: process.env.NEXT_PUBLIC_XUNFEI_API_KEY || '您的讯飞ApiKey',
    apiSecret: process.env.NEXT_PUBLIC_XUNFEI_API_SECRET || '您的讯飞ApiSecret',
    language: 'zh_cn',
    sampleRate: 16000
  };

  /**
   * 初始化讯飞语音识别服务
   */
  async initialize(config?: SpeechRecognitionConfig): Promise<boolean> {
    // 如果没有提供配置，使用默认配置
    this.config = config || this.defaultConfig;
    await this.loadScripts();
    return this.scriptLoaded;
  }

  /**
   * 加载必要的脚本
   */
  private async loadScripts(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // 确保先前加载的脚本不会重复加载
      const existingScripts = Array.from(document.getElementsByTagName('script'))
        .map(script => script.src);
        
      // 加载基础脚本
      const scripts = [
        '/xunfei/crypto-js.js',
        '/xunfei/hmac-sha256.js',
        '/xunfei/enc-base64-min.js',
        '/xunfei/index.umd.js'
      ];

      const loadScript = (src: string): Promise<void> => {
        // 如果脚本已加载，不重复加载
        const fullSrc = new URL(src, window.location.origin).href;
        if (existingScripts.some(scriptSrc => scriptSrc === fullSrc)) {
          return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
          document.body.appendChild(script);
          
          // 添加超时处理
          setTimeout(() => {
            if (!script.onload) {
              reject(new Error(`Script loading timeout: ${src}`));
            }
          }, 10000); // 10秒超时
        });
      };

      // 按顺序加载脚本，而不是并行，确保依赖正确
      for (const script of scripts) {
        await loadScript(script);
      }
      
      // 额外检查关键对象是否存在
      if (typeof window.RecorderManager === 'undefined' || typeof window.CryptoJS === 'undefined') {
        console.error('必要的全局对象未定义，脚本可能未正确加载');
        this.scriptLoaded = false;
        return;
      }
      
      this.scriptLoaded = true;
      console.log('所有讯飞语音识别脚本加载成功');
    } catch (error) {
      console.error('Failed to load XunFei scripts:', error);
      this.scriptLoaded = false;
    }
  }

  /**
   * 获取WebSocket URL（讯飞特有的签名机制）
   */
  private getWebSocketUrl(): string {
    if (!this.config) throw new Error('讯飞语音识别服务未初始化');

    const url = "wss://iat-api.xfyun.cn/v2/iat";
    const host = "iat-api.xfyun.cn";
    const date = new Date().toUTCString();
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    
    let signature = '';
    let authorization = '';
    
    if (typeof window !== 'undefined') {
      // @ts-expect-error - CryptoJS 是通过脚本加载的全局变量
      const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.config.apiSecret);
      // @ts-expect-error - CryptoJS 是通过脚本加载的全局变量
      signature = CryptoJS.enc.Base64.stringify(signatureSha);
      const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
      authorization = btoa(authorizationOrigin);
    }
    
    return `${url}?authorization=${authorization}&date=${date}&host=${host}`;
  }

  /**
   * 将ArrayBuffer转换为Base64字符串
   */
  private toBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * 解析讯飞返回的识别结果
   */
  private parseRecognitionResult(resultData: string): RecognitionResult {
    const jsonData = JSON.parse(resultData);
    let isFinished = false;
    
    if (jsonData.data && jsonData.data.result) {
      const data = jsonData.data.result;
      let str = "";
      const ws = data.ws;
      for (let i = 0; i < ws.length; i++) {
        str = str + ws[i].cw[0].w;
      }
      
      // 根据状态设置文本，不累加
      this.finalText = str;
    }
    
    // 检查识别是否结束
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      isFinished = true;
    }
    
    return {
      text: this.finalText,
      isFinished,
      rawResponse: jsonData
    };
  }

  /**
   * 连接WebSocket并开始识别
   */
  private connectWebSocket(
    onMessage: (result: RecognitionResult) => void,
    onError: (error: Error) => void,
    onOpen?: () => void
  ): WebSocket | null {
    try {
      const websocketUrl = this.getWebSocketUrl();
      
      if ("WebSocket" in window) {
        const ws = new WebSocket(websocketUrl);
        
        ws.onopen = () => {
          const params = {
            common: {
              app_id: this.config?.appId,
            },
            business: {
              language: this.config?.language || "zh_cn",
              domain: "iat",
              accent: "mandarin",
              vad_eos: 10000,
            },
            data: {
              status: 0,
              format: "audio/L16;rate=16000",
              encoding: "raw",
            },
          };
          
          ws.send(JSON.stringify(params));
          if (onOpen) onOpen();
        };
        
        ws.onmessage = (e) => {
          try {
            const result = this.parseRecognitionResult(e.data);
            onMessage(result);
            
            if (result.isFinished) {
              ws.close();
              this.isProcessing = false;
            }
          } catch {
            onError(new Error('解析识别结果失败'));
          }
        };
        
        ws.onerror = () => {
          onError(new Error('WebSocket连接错误'));
          this.isProcessing = false;
        };
        
        ws.onclose = () => {
          this.isProcessing = false;
        };
        
        return ws;
      } else {
        onError(new Error('浏览器不支持WebSocket'));
        return null;
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('未知错误'));
      return null;
    }
  }

  /**
   * 初始化录音管理器
   */
  private initRecorder(): Promise<RecorderManager> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('只能在浏览器环境中使用'));
        return;
      }

      try {
        const recorder = new window.RecorderManager('/xunfei');
        resolve(recorder);
      } catch {
        reject(new Error('初始化录音管理器失败'));
      }
    });
  }

  /**
   * 开始实时语音识别
   */
  async startRealTimeRecognition(options: RealTimeSpeechOptions): Promise<void> {
    if (this.isProcessing) {
      throw new Error('已有识别任务正在进行');
    }
    
    this.isProcessing = true;
    this.tempText = '';
    this.finalText = '';
    
    try {
      // 1. 连接WebSocket
      this.wsInstance = this.connectWebSocket(
        options.onResult,
        options.onError,
        options.onStart
      );
      
      if (!this.wsInstance) {
        throw new Error('WebSocket连接失败');
      }
      
      // 2. 初始化录音管理器
      this.recorderInstance = await this.initRecorder();
      
      // 3. 设置录音回调
      this.recorderInstance.onFrameRecorded = ({ isLastFrame, frameBuffer }: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => {
        if (this.wsInstance && this.wsInstance.readyState === this.wsInstance.OPEN) {
          this.wsInstance.send(
            JSON.stringify({
              data: {
                status: isLastFrame ? 2 : 1,
                format: "audio/L16;rate=16000",
                encoding: "raw",
                audio: this.toBase64(frameBuffer),
              },
            })
          );
        }
      };
      
      this.recorderInstance.onStop = () => {
        if (options.onStop) options.onStop();
      };
      
      // 4. 开始录音
      this.recorderInstance.start({
        sampleRate: this.config?.sampleRate || 16000,
        frameSize: 1280,
      });
      
    } catch (error) {
      this.isProcessing = false;
      options.onError(error instanceof Error ? error : new Error('启动语音识别失败'));
    }
  }

  /**
   * 停止实时语音识别
   */
  stopRealTimeRecognition(): void {
    if (this.recorderInstance) {
      this.recorderInstance.stop();
    }
    
    if (this.wsInstance) {
      // WebSocket可能已经自动关闭，所以这里需要检查
      if (this.wsInstance.readyState === this.wsInstance.OPEN) {
        this.wsInstance.close();
      }
      this.wsInstance = null;
    }
    
    this.isProcessing = false;
  }

  /**
   * 开始文件语音识别
   */
  async recognizeFile(options: FileSpeechOptions): Promise<void> {
    if (this.isProcessing) {
      throw new Error('已有识别任务正在进行');
    }
    
    this.isProcessing = true;
    this.tempText = '';
    this.finalText = '';
    
    try {
      if (!options.file) {
        throw new Error('未提供文件');
      }
      
      if (options.onStart) options.onStart();
      
      // 连接WebSocket并在连接成功后处理文件
      this.wsInstance = this.connectWebSocket(
        options.onResult,
        options.onError,
        () => {
          // WebSocket连接成功后，开始读取和处理文件
          const reader = new FileReader();
          reader.readAsArrayBuffer(options.file);
          
          reader.onload = (evt) => {
            if (!evt.target || !evt.target.result) return;
            
            const audioArrayBuffer = evt.target.result as ArrayBuffer;
            const audioString = new TextDecoder().decode(new Uint8Array(audioArrayBuffer));
            
            let offset = 0;
            const chunkSize = 1280; // 每个数据包的大小
            const totalChunks = Math.ceil(audioString.length / chunkSize);
            let processedChunks = 0;
            
            // 分块发送音频数据
            while (offset < audioString.length) {
              const subString = audioString.substring(offset, offset + chunkSize);
              offset += chunkSize;
              
              const isEnd = offset >= audioString.length;
              processedChunks++;
              
              if (options.onProgress) {
                options.onProgress(processedChunks / totalChunks);
              }
              
              if (this.wsInstance && this.wsInstance.readyState === this.wsInstance.OPEN) {
                this.wsInstance.send(
                  JSON.stringify({
                    data: {
                      status: isEnd ? 2 : 1,
                      format: "audio/L16;rate=16000",
                      encoding: "raw",
                      audio: window.btoa(subString)
                    },
                  })
                );
              }
              
              // 最后一帧后不需要继续发送
              if (isEnd) {
                break;
              }
            }
          };
          
          reader.onerror = () => {
            options.onError(new Error('读取文件失败'));
            this.cancel();
          };
        }
      );
      
      if (!this.wsInstance) {
        throw new Error('WebSocket连接失败');
      }
      
    } catch (error) {
      this.isProcessing = false;
      options.onError(error instanceof Error ? error : new Error('开始文件识别失败'));
    }
  }

  /**
   * 取消正在进行的识别
   */
  cancel(): void {
    this.stopRealTimeRecognition();
    this.isProcessing = false;
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.cancel();
    this.config = null;
    this.recorderInstance = null;
  }
} 
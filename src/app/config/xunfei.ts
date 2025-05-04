import { SpeechRecognitionConfig } from '../interfaces/SpeechRecognition';

/**
 * 讯飞语音识别服务配置
 * 你可以在这里直接设置配置，而不是使用环境变量
 */
export const xunfeiConfig: SpeechRecognitionConfig = {
  // 请将以下信息替换为您的讯飞API实际信息
  appId: 'd30c2d8a',         // 替换为您实际的讯飞AppID
  apiKey: 'af0ac7c30f3e99d348aea3e51523480b', // 替换为您实际的讯飞ApiKey
  apiSecret: 'MDY3Y2RkZGNhODU5OGY4ODBjNjg1ZjI1', // 替换为您实际的讯飞ApiSecret
  language: 'zh_cn',
  sampleRate: 16000
}; 
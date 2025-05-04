'use client';

import { SpeechRecognitionFactory, SpeechRecognitionService } from '../interfaces/SpeechRecognition';
import { XunfeiSpeechRecognition } from './xunfei/XunfeiSpeechRecognition';

// 支持的厂商列表
export enum SpeechVendor {
  XUNFEI = 'xunfei',
  // 可以添加其他厂商，如
  // BAIDU = 'baidu',
  // ALIBABA = 'alibaba',
  // TENCENT = 'tencent',
}

/**
 * 语音识别工厂类实现
 */
export class SpeechRecognitionFactoryImpl implements SpeechRecognitionFactory {
  /**
   * 创建语音识别服务实例
   * @param vendor 厂商标识符
   * @returns 语音识别服务实例
   */
  createService(vendor: string): SpeechRecognitionService {
    switch (vendor.toLowerCase()) {
      case SpeechVendor.XUNFEI:
        return new XunfeiSpeechRecognition();
      
      // 未来可以添加其他厂商的实现
      // case SpeechVendor.BAIDU:
      //   return new BaiduSpeechRecognition();
      // case SpeechVendor.ALIBABA:
      //   return new AlibabaSpeechRecognition();
      
      default:
        throw new Error(`不支持的语音识别厂商: ${vendor}`);
    }
  }
}

// 导出工厂单例
export const speechRecognitionFactory = new SpeechRecognitionFactoryImpl(); 
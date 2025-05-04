'use client';

import { useState, useEffect, useRef } from 'react';
import { RecognitionResult } from '../interfaces/SpeechRecognition';
import { speechRecognitionFactory, SpeechVendor } from '../services/SpeechRecognitionFactory';
import { xunfeiConfig } from '../config/xunfei';

export default function VoiceRecognition() {
  const [resultText, setResultText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const speechServiceRef = useRef(speechRecognitionFactory.createService(SpeechVendor.XUNFEI));

  // 初始化语音识别服务
  useEffect(() => {
    const speechService = speechServiceRef.current;
    const initSpeechService = async () => {
      try {
        // 使用配置文件中的设置
        const config = xunfeiConfig;
        
        // 检查配置是否完整，只检查是否有值，不再检查是否等于占位符值
        if (!config.appId || !config.apiKey || !config.apiSecret) {
          setConfigError('请在配置文件中设置讯飞API凭证信息');
          return;
        }

        const initialized = await speechService.initialize(config);
        
        setIsInitialized(initialized);
        if (!initialized) {
          console.error('语音识别服务初始化失败');
          setConfigError('语音识别服务初始化失败');
        }
      } catch (error) {
        console.error('初始化失败:', error);
        setConfigError(error instanceof Error ? error.message : '初始化发生未知错误');
      }
    };
    
    initSpeechService();
    
    return () => {
      // 组件卸载时释放资源
      speechService.dispose();
    };
  }, []);

  // 处理识别结果
  const handleRecognitionResult = (result: RecognitionResult) => {
    setResultText(result.text);
    
    if (result.isFinished) {
      setIsProcessing(false);
    }
  };

  // 处理错误
  const handleError = (error: Error) => {
    console.error('语音识别错误:', error);
    setIsProcessing(false);
  };

  // 开始语音识别
  const startRecognition = async () => {
    if (!isInitialized) {
      alert('语音识别服务未初始化');
      return;
    }
    
    if (isProcessing) {
      return;
    }
    
    setIsProcessing(true);
    setResultText('');
    
    try {
      await speechServiceRef.current.startRealTimeRecognition({
        onResult: handleRecognitionResult,
        onError: handleError,
        onStart: () => console.log('开始录音'),
        onStop: () => console.log('停止录音')
      });
    } catch (error) {
      console.error('启动语音识别失败:', error);
      setIsProcessing(false);
    }
  };

  // 停止语音识别
  const stopRecognition = () => {
    if (!isProcessing) {
      return;
    }
    
    speechServiceRef.current.stopRealTimeRecognition();
    setIsProcessing(false);
  };

  // 如果配置有误，显示配置错误提示
  if (configError) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">实时语音听写</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">配置错误</p>
          <p>{configError}</p>
          <p className="mt-2 text-sm">
            请在配置文件中设置讯飞API凭证信息：
          </p>
          <ul className="list-disc pl-5 mt-1">
            <li>src/app/config/xunfei.ts</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">实时语音听写</h1>
      
      <div className="mb-6 flex flex-col items-center">
        <button
          className={`px-6 py-3 rounded-lg text-white font-semibold ${
            isProcessing 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          onClick={isProcessing ? stopRecognition : startRecognition}
          disabled={!isInitialized}
        >
          {isProcessing ? '停止录音' : '开始录音'}
        </button>
      </div>
      
      <div className="border rounded-lg p-4 min-h-[300px] shadow-sm mb-4">
        <h2 className="text-lg font-semibold mb-2">识别结果</h2>
        <div className="whitespace-pre-wrap">
          {isProcessing && !resultText 
            ? '正在识别中...' 
            : resultText || '等待识别结果...'}
        </div>
      </div>
      
      <div className="text-sm text-gray-500 mt-4">
        <p>提示：点击&quot;开始录音&quot;按钮后即可开始说话，系统会自动识别您的语音并转为文字。</p>
      </div>
    </div>
  );
} 
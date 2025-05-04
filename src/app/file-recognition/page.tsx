'use client';

import { useState, useEffect, useRef } from 'react';
import { RecognitionResult } from '../interfaces/SpeechRecognition';
import { speechRecognitionFactory, SpeechVendor } from '../services/SpeechRecognitionFactory';
import { xunfeiConfig } from '../config/xunfei';

export default function FileRecognition() {
  const [resultText, setResultText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  // 处理识别结果
  const handleRecognitionResult = (result: RecognitionResult) => {
    setResultText(result.text);
    
    if (result.isFinished) {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  // 处理错误
  const handleError = (error: Error) => {
    console.error('语音识别错误:', error);
    setIsProcessing(false);
    alert(`识别失败: ${error.message}`);
  };

  // 处理进度更新
  const handleProgress = (progressValue: number) => {
    setProgress(Math.round(progressValue * 100));
  };

  // 开始处理文件
  const processAudioFile = async () => {
    if (!isInitialized) {
      alert('语音识别服务未初始化');
      return;
    }
    
    if (!uploadedFile) {
      alert('请先选择音频文件');
      return;
    }
    
    if (isProcessing) {
      return;
    }
    
    setIsProcessing(true);
    setResultText('');
    setProgress(0);
    
    try {
      await speechServiceRef.current.recognizeFile({
        file: uploadedFile,
        onResult: handleRecognitionResult,
        onError: handleError,
        onStart: () => console.log('开始处理文件'),
        onStop: () => console.log('文件处理完成'),
        onProgress: handleProgress
      });
    } catch (error) {
      console.error('启动文件识别失败:', error);
      setIsProcessing(false);
    }
  };

  // 取消处理
  const cancelProcessing = () => {
    if (!isProcessing) {
      return;
    }
    
    speechServiceRef.current.cancel();
    setIsProcessing(false);
  };

  // 如果配置有误，显示配置错误提示
  if (configError) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">语音文件听写</h1>
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
      <h1 className="text-2xl font-bold mb-6">语音文件听写</h1>
      
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/wav,audio/pcm"
            className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-500 hover:file:bg-blue-100"
            disabled={isProcessing}
          />
          <button
            onClick={isProcessing ? cancelProcessing : processAudioFile}
            disabled={!isInitialized || (!uploadedFile && !isProcessing)}
            className={`px-6 py-2 rounded-lg text-white font-semibold ${
              !isInitialized || (!uploadedFile && !isProcessing)
                ? 'bg-gray-400 cursor-not-allowed'
                : isProcessing
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isProcessing ? '取消处理' : '开始识别'}
          </button>
        </div>
        
        {uploadedFile && (
          <div className="text-sm text-gray-600 mb-2">
            已选择文件: {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
          </div>
        )}
        
        {isProcessing && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
            <div className="text-xs text-gray-500 mt-1">处理进度: {progress}%</div>
          </div>
        )}
      </div>
      
      <div className="border rounded-lg p-4 min-h-[300px] shadow-sm mb-4">
        <h2 className="text-lg font-semibold mb-2">识别结果</h2>
        <div className="whitespace-pre-wrap">
          {isProcessing && !resultText 
            ? '正在处理音频文件，请稍候...' 
            : resultText || '等待识别结果...'}
        </div>
      </div>
      
      <div className="text-sm text-gray-500 mt-4">
        <p>提示：目前支持的音频格式为PCM/WAV，采样率16kHz，位深16bit，单声道。</p>
        <p>文件大小建议不超过5MB，时长不超过60秒。</p>
      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect, useRef } from 'react';

interface XunfeiRecorder {
  start(options: { sampleRate: number; frameSize: number }): void;
  stop(): void;
  onFrameRecorded?: (data: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => void;
  onStop?: (audioBuffers: ArrayBuffer[]) => void;
}

interface RecorderManagerProps {
  onFrameRecorded: (data: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => void;
  onStop: (audioBuffers: ArrayBuffer[]) => void;
  onBeforeStart?: () => boolean;
}

const RecorderManager: React.FC<RecorderManagerProps> = ({ onFrameRecorded, onStop, onBeforeStart }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const recorderRef = useRef<XunfeiRecorder | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 初始化录音管理器
    if (typeof window !== 'undefined') {
      // 动态导入录音管理器脚本
      const script = document.createElement('script');
      script.src = '/xunfei/index.umd.js';
      script.async = true;
      script.onload = () => {
        recorderRef.current = new window.RecorderManager('/xunfei');
        
        // 设置回调
        if (recorderRef.current) {
          recorderRef.current.onFrameRecorded = onFrameRecorded;
          recorderRef.current.onStop = onStop;
        }
      };
      document.body.appendChild(script);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [onFrameRecorded, onStop]);

  // 开始录音
  const startRecording = () => {
    // 如果有前置检查回调，先执行，如果返回false则取消录音
    if (onBeforeStart && !onBeforeStart()) {
      return;
    }
    
    if (recorderRef.current) {
      recorderRef.current.start({
        sampleRate: 16000,
        frameSize: 1280,
      });
      setIsRecording(true);
      startCountdown();
    } else {
      console.error('录音管理器未初始化');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(60);
    }
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(60);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <button
      className={`px-6 py-3 rounded-lg text-white font-semibold ${
        isRecording 
          ? 'bg-red-500 hover:bg-red-600' 
          : 'bg-blue-500 hover:bg-blue-600'
      }`}
      onClick={isRecording ? stopRecording : startRecording}
    >
      {isRecording ? `录音中 (${countdown}s)` : '开始录音'}
    </button>
  );
};

export default RecorderManager; 
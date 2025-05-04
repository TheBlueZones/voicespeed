'use client';

import { useState, useEffect, useRef } from 'react';
import { RecognitionResult } from '@interfaces/SpeechRecognition';
import { speechRecognitionFactory, SpeechVendor } from '@services/SpeechRecognitionFactory';
import { xunfeiConfig } from '@config/xunfei';

export default function VoiceRecognition2() {
  const [resultText, setResultText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // 语速监测相关状态
  const startTimeRef = useRef<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [speechRate, setSpeechRate] = useState(0);
  const [averageRate, setAverageRate] = useState(0);
  // 添加语音数据历史记录，用于滑动窗口计算
  const [speechDataHistory, setSpeechDataHistory] = useState<{time: number, textLength: number}[]>([]);
  // 添加一个ref来存储累计的总字数
  const totalWordCountRef = useRef(0);
  
  // 添加一个状态来跟踪实时时长
  const [currentDuration, setCurrentDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 新增ref
  const currentDurationRef = useRef(0);
  
  const speechServiceRef = useRef(speechRecognitionFactory.createService(SpeechVendor.XUNFEI));
  const lastResultLengthRef = useRef(0);

  // 初始化语音识别服务
  useEffect(() => {
    const speechService = speechServiceRef.current;
    const initSpeechService = async () => {
      try {
        const config = xunfeiConfig;
        
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
      speechService.dispose();
    };
  }, []);

  // 计算中文字符数（考虑中文一个字符算一个字）
  const countChineseWords = (text: string): number => {
    // 移除标点符号和空格
    const cleanText = text.replace(/[，。！？、；：""''（）【】《》\s]/g, '');
    return cleanText.length;
  };

  // 使用滑动窗口计算当前语速
  const calculateCurrentRate = (dataHistory: {time: number, textLength: number}[], windowSize = 10): number => {
    console.log('--- 语速计算开始 ---');
    console.log('当前历史数据点:', dataHistory.map(d => ({
        时间: new Date(d.time).toLocaleTimeString(),
        字数: d.textLength
    })));

    if (dataHistory.length < 2) {
        console.log('数据点不足，返回0');
        return 0;
    }
    
    const currentTime = Date.now();
    const windowStart = currentTime - (windowSize * 1000);
    const recentPoints = dataHistory.filter(p => p.time >= windowStart);
    
    console.log(`滑动窗口大小: ${windowSize}秒`);
    console.log('窗口内的数据点:', recentPoints.map(d => ({
        时间: new Date(d.time).toLocaleTimeString(),
        字数: d.textLength
    })));

    if (recentPoints.length >= 2) {
        const firstPoint = recentPoints[0];
        const lastPoint = recentPoints[recentPoints.length - 1];
        const wordDiff = lastPoint.textLength - firstPoint.textLength;
        const timeDiff = (lastPoint.time - firstPoint.time) / 1000 / 60;
        
        console.log('计算详情:', {
            起始时间: new Date(firstPoint.time).toLocaleTimeString(),
            结束时间: new Date(lastPoint.time).toLocaleTimeString(),
            起始字数: firstPoint.textLength,
            结束字数: lastPoint.textLength,
            字数差: wordDiff,
            时间差_秒: timeDiff * 60,
            时间差_分钟: timeDiff
        });

        if (timeDiff > 0 && wordDiff > 0) {
            const rate = Math.round(wordDiff / timeDiff);
            console.log(`滑动窗口计算结果: ${rate} 字/分钟`);
            return rate;
        }
    }
    
    // 如无足够数据点或窗口内无变化，使用累计法
    if (dataHistory.length >= 2 && startTimeRef.current) {
        const totalWords = totalWordCountRef.current;
        const totalTimeMinutes = currentDuration / 60;
        
        console.log('使用累计法计算:', {
            总字数: totalWords,
            总时长_分钟: totalTimeMinutes
        });

        if (totalTimeMinutes > 0 && totalWords > 0) {
            const rate = Math.round(totalWords / totalTimeMinutes);
            console.log(`累计法计算结果: ${rate} 字/分钟`);
            return rate;
        }
    }
    
    console.log('无法计算语速，返回0');
    return 0;
  };

  // 开始定时器来更新总时长
  const startDurationTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentDuration(0);
    currentDurationRef.current = 0;
    timerRef.current = setInterval(() => {
      setCurrentDuration(prev => {
        currentDurationRef.current = prev + 1;
        return prev + 1;
      });
    }, 1000);
  };
  
  // 停止定时器
  const stopDurationTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 在组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 处理识别结果
  const handleRecognitionResult = (result: RecognitionResult) => {
    setResultText(result.text);
    
    // 打印识别结果到控制台
    console.log('识别结果:', result);
    console.log('startTime', startTimeRef.current);
    // 语速计算
    if (startTimeRef.current) {
      const currentTime = Date.now();
      const currentTextLength = countChineseWords(result.text);
      
      // 更新累计总字数
      totalWordCountRef.current += currentTextLength;
      setWordCount(totalWordCountRef.current);
      
      // 添加新的数据点到历史记录
      setSpeechDataHistory(prev => {
        const newHistory = [...prev, { time: currentTime, textLength: totalWordCountRef.current }];
        
        // 计算当前语速（使用滑动窗口）
        const currentRate = calculateCurrentRate(newHistory);
        setSpeechRate(currentRate);
        
        // 实时计算平均语速（总字数/总时间）
        const totalTimeMinutes = currentDurationRef.current / 60;
        if (totalTimeMinutes > 0) {
          setAverageRate(Math.round(totalWordCountRef.current / totalTimeMinutes));
        }
        
        return newHistory;
      });
    }
    
    if (result.isFinished) {
      // 停止计时
      stopDurationTimer();
      
      const finishTime = Date.now();
      setEndTime(finishTime);
      
      // 计算最终语速
      if (startTimeRef.current && result.text.length > 0) {
        const totalTime = currentDuration / 60;
        if (totalTime > 0) {
          setAverageRate(Math.round(totalWordCountRef.current / totalTime));
        }
      }
      
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
    
    setIsConnecting(true);
    
    try {
      await speechServiceRef.current.startRealTimeRecognition({
        onResult: handleRecognitionResult,
        onError: handleError,
        onStart: () => {
          console.log('开始录音');
          // 在连接成功并开始录音时重置所有状态
          setIsProcessing(true);
          setResultText('');
          startTimeRef.current = Date.now();
          totalWordCountRef.current = 0; // 重置累计总字数
          console.log('startTime第一次', startTimeRef.current);
          setEndTime(null);
          setWordCount(0);
          setSpeechRate(0);
          setAverageRate(0);
          setSpeechDataHistory([]);
          lastResultLengthRef.current = 0;
          setIsConnecting(false);
          
          // 开始计时
          startDurationTimer();
        },
        onStop: () => console.log('停止录音')
      });
    } catch (error) {
      console.error('启动语音识别失败:', error);
      setIsProcessing(false);
      setIsConnecting(false);
    }
  };

  // 停止语音识别
  const stopRecognition = () => {
    if (!isProcessing) {
      return;
    }
    
    // 停止计时
    stopDurationTimer();
    
    const stopTime = Date.now();
    setEndTime(stopTime);
    
    // 计算最终的语速和平均语速
    if (startTimeRef.current && resultText.length > 0) {
      // 使用totalWordCountRef.current作为最终字数，因为它一直在累积
      const finalWordCount = totalWordCountRef.current;
      setWordCount(finalWordCount);
      
      // 计算最终平均语速（总字数/总时间）
      const totalTimeMinutes = currentDuration / 60; // 使用计时器时间而不是时间差
      if (totalTimeMinutes > 0) {
        const finalAvgRate = Math.round(finalWordCount / totalTimeMinutes);
        setAverageRate(finalAvgRate);
        
        // 更新当前语速，使用最近的数据
        setSpeechDataHistory(prev => {
          const updatedHistory = [...prev, { time: stopTime, textLength: finalWordCount }];
          const finalCurrentRate = calculateCurrentRate(updatedHistory);
          setSpeechRate(finalCurrentRate);
          return updatedHistory;
        });
      }
    }
    
    speechServiceRef.current.stopRealTimeRecognition();
    setIsProcessing(false);
  };

  // 格式化总时长
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds}秒`;
    }
  };
  
  // 获取格式化的总时长
  const getTotalDuration = (): string => {
    return formatDuration(currentDuration);
  };

  // 获取语速等级和对应颜色
  const getSpeechRateLevel = () => {
    if (speechRate === 0) {
      return { 
        level: '未开始', 
        color: '#9CA3AF', 
        bgColor: '#F3F4F6', 
        textColor: '#4B5563',
        useBgColor: false
      };
    } else if (speechRate < 120) {
      return { 
        level: '偏慢', 
        color: '#2563EB', 
        bgColor: '#DBEAFE', 
        textColor: '#1D4ED8',
        useBgColor: false
      };
    } else if (speechRate < 180) {
      return { 
        level: '适中', 
        color: '#059669', 
        bgColor: '#D1FAE5', 
        textColor: '#047857',
        useBgColor: false
      };
    } else if (speechRate < 250) {
      return { 
        level: '较快', 
        color: '#D97706', 
        bgColor: '#FEF3C7', 
        textColor: '#B45309',
        useBgColor: false
      };
    } else {
      return { 
        level: '非常快', 
        color: '#FFFFFF', 
        bgColor: '#EF4444', 
        textColor: '#FFFFFF',
        useBgColor: true
      };
    } 
  };

  // 如果配置有误，显示配置错误提示
  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">实时语速监测</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm mb-4">
            <div className="flex items-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-bold text-xl text-red-700">配置错误</p>
            </div>
            <p className="text-red-700 mb-4">{configError}</p>
            <div className="bg-red-100 rounded-lg p-4 text-sm">
              <p className="font-medium text-red-800 mb-2">
                请在配置文件中设置讯飞API凭证信息：
              </p>
              <ul className="list-disc pl-5 text-red-700">
                <li>src/app/config/xunfei.ts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 获取当前语速等级信息
  const rateLevel = getSpeechRateLevel();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">实时语速监测</h1>
      
      <div className="w-full max-w-md animate-fadeIn">
        <div className="mb-6 flex justify-center">
          <button
            className="px-8 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold flex items-center justify-center shadow-md transition-all duration-300 transform hover:scale-105 active:scale-95"
            onClick={isProcessing ? stopRecognition : startRecognition}
            disabled={!isInitialized || isConnecting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isConnecting ? '连接中...' : (isProcessing ? '停止录音' : '开始录音')}
          </button>
        </div>
        
        {/* 语速统计卡片 */}
        <div className="bg-white rounded-2xl p-5 shadow-md mb-6">
          <div className="flex items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-800">语速统计</h2>
          </div>
          
          {/* 当前语速 */}
          <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 mb-4">
            <span className="text-gray-700 font-medium">当前语速:</span>
            <span className="font-bold text-blue-600 text-3xl">{speechRate} <span className="text-lg">字/分钟</span></span>
          </div>
          
          {/* 平均语速 */}
          <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 mb-4">
            <span className="text-gray-700 font-medium">平均语速:</span>
            <span className="font-bold text-green-600 text-3xl">{averageRate} <span className="text-lg">字/分钟</span></span>
          </div>
          
          {/* 总字数和总时长（次要信息）*/}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50">
              <div className="text-gray-500 text-sm mb-1">总字数</div>
              <div className="font-bold text-purple-500 text-xl">{wordCount} 字</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50">
              <div className="text-gray-500 text-sm mb-1">总时长</div>
              <div className="font-bold text-indigo-500 text-xl">{getTotalDuration()}</div>
            </div>
          </div>
        </div>
        
        {/* 语速等级 - 单独圆形显示 */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3 text-center">
            <span className="text-gray-700 font-semibold text-lg">语速等级</span>
          </div>
          <div 
            className="w-56 h-56 rounded-full flex items-center justify-center transform transition-all duration-300 relative overflow-hidden"
            style={{ 
              background: rateLevel.useBgColor 
                ? `linear-gradient(135deg, ${rateLevel.bgColor}, #FF5252)`
                : 'white',
              boxShadow: rateLevel.useBgColor 
                ? `0 15px 35px -12px rgba(239, 68, 68, 0.5), 0 0 0 6px rgba(239, 68, 68, 0.4), 0 0 0 3px #EF4444, 0 0 20px rgba(239, 68, 68, 0.3)` 
                : `0 12px 30px -8px rgba(0, 0, 0, 0.15), 0 0 0 6px ${rateLevel.color}40, 0 0 0 3px ${rateLevel.color}`,
              border: `4px solid ${rateLevel.useBgColor ? '#fff' : 'white'}`,
            }}
          >
            {rateLevel.useBgColor && (
              <div className="absolute inset-0 bg-red-500 opacity-20" 
                style={{ 
                  background: 'radial-gradient(circle at 30% 30%, #FF5252, #EF4444)'
                }}
              ></div>
            )}
            <span 
              className="font-bold text-4xl relative" 
              style={{ 
                color: rateLevel.useBgColor ? '#FFFFFF' : rateLevel.color,
                textShadow: rateLevel.useBgColor 
                  ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              {rateLevel.level}
            </span>
          </div>
        </div>
      </div>
      
      {/* 添加页面底部版权信息 */}
      <div className="mt-auto pt-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} 语速监测系统
      </div>
      
      {/* 添加全局样式 */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 
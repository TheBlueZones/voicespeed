'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { RecognitionResult } from '@interfaces/SpeechRecognition';
import { MockSpeechRecognitionService } from './services/MockSpeechRecognitionService';

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
  const [speechDataHistory, setSpeechDataHistory] = useState<{time: number, textLength: number}[]>([]);
  const totalWordCountRef = useRef(0);

  const [currentDuration, setCurrentDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentDurationRef = useRef(0);

  const speechServiceRef = useRef(new MockSpeechRecognitionService());
  const lastResultLengthRef = useRef(0);

  // 初始化语音识别服务
  useEffect(() => {
    const service = speechServiceRef.current;
    service.initialize().then((ok) => {
      if (ok) {
        setIsInitialized(true);
      } else {
        setConfigError('语音识别服务初始化失败');
      }
    }).catch(() => {
      setConfigError('语音识别服务初始化失败');
    });
    return () => { service.dispose(); };
  }, []);

  const countChineseWords = (text: string): number => {
    const cleanText = text.replace(/[，。！？、；：""''（）【】《》\s]/g, '');
    return cleanText.length;
  };

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

  const stopDurationTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleRecognitionResult = (result: RecognitionResult) => {
    setResultText(result.text);

    console.log('识别结果:', result);
    console.log('startTime', startTimeRef.current);
    if (startTimeRef.current) {
      const currentTime = Date.now();
      const currentTextLength = countChineseWords(result.text);

      totalWordCountRef.current = currentTextLength;
      setWordCount(totalWordCountRef.current);

      setSpeechDataHistory(prev => {
        const newHistory = [...prev, { time: currentTime, textLength: totalWordCountRef.current }];

        const currentRate = calculateCurrentRate(newHistory);
        setSpeechRate(currentRate);

        const totalTimeMinutes = currentDurationRef.current / 60;
        if (totalTimeMinutes > 0) {
          setAverageRate(Math.round(totalWordCountRef.current / totalTimeMinutes));
        }

        return newHistory;
      });
    }

    if (result.isFinished) {
      stopDurationTimer();

      const finishTime = Date.now();
      setEndTime(finishTime);

      if (startTimeRef.current && result.text.length > 0) {
        const totalTime = currentDuration / 60;
        if (totalTime > 0) {
          setAverageRate(Math.round(totalWordCountRef.current / totalTime));
        }
      }

      setIsProcessing(false);
    }
  };

  const handleError = (error: Error) => {
    console.error('语音识别错误:', error);
    setIsProcessing(false);
  };

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
          setIsProcessing(true);
          setResultText('');
          startTimeRef.current = Date.now();
          totalWordCountRef.current = 0;
          console.log('startTime第一次', startTimeRef.current);
          setEndTime(null);
          setWordCount(0);
          setSpeechRate(0);
          setAverageRate(0);
          setSpeechDataHistory([]);
          lastResultLengthRef.current = 0;
          setIsConnecting(false);

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

  const stopRecognition = () => {
    if (!isProcessing) {
      return;
    }

    stopDurationTimer();

    const stopTime = Date.now();
    setEndTime(stopTime);

    if (startTimeRef.current && resultText.length > 0) {
      const finalWordCount = totalWordCountRef.current;
      setWordCount(finalWordCount);

      const totalTimeMinutes = currentDuration / 60;
      if (totalTimeMinutes > 0) {
        const finalAvgRate = Math.round(finalWordCount / totalTimeMinutes);
        setAverageRate(finalAvgRate);

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

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds}秒`;
    }
  };

  const getTotalDuration = (): string => {
    return formatDuration(currentDuration);
  };

  const getSpeechRateLevel = () => {
    if (speechRate === 0) {
      return {
        level: '待开始',
        color: '#6b7280',
        accentColor: 'rgba(107, 114, 128, 0.5)',
        glowColor: 'rgba(107, 114, 128, 0.1)',
        progress: 0,
      };
    } else if (speechRate < 120) {
      return {
        level: '偏慢',
        color: '#448aff',
        accentColor: 'rgba(68, 138, 255, 0.5)',
        glowColor: 'rgba(68, 138, 255, 0.15)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else if (speechRate < 180) {
      return {
        level: '适中',
        color: '#00e676',
        accentColor: 'rgba(0, 230, 118, 0.5)',
        glowColor: 'rgba(0, 230, 118, 0.15)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else if (speechRate < 250) {
      return {
        level: '较快',
        color: '#ffab00',
        accentColor: 'rgba(255, 171, 0, 0.5)',
        glowColor: 'rgba(255, 171, 0, 0.15)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else {
      return {
        level: '极速',
        color: '#ff1744',
        accentColor: 'rgba(255, 23, 68, 0.5)',
        glowColor: 'rgba(255, 23, 68, 0.2)',
        progress: 1,
      };
    }
  };

  // SVG 圆环参数
  const gaugeRadius = 90;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const rateLevel = getSpeechRateLevel();
  const gaugeOffset = gaugeCircumference - (rateLevel.progress * gaugeCircumference);

  // 音波条动画延迟
  const waveBars = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      delay: `${i * 0.15}s`,
      height: [60, 80, 100, 70, 90][i],
    })), []
  );

  if (configError) {
    return (
      <div className="min-h-screen ambient-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-float-up">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg text-white/90">配置错误</p>
                <p className="text-sm text-white/40">{configError}</p>
              </div>
            </div>
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
              <p className="text-sm text-red-300/70">
                请配置语音识别服务商后重试
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] ambient-bg flex flex-col items-center px-4 py-6 sm:py-8 md:py-12 relative overflow-hidden safe-area-top safe-area-bottom safe-area-x no-select">
      {/* Ambient glow that follows the current rate color */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] rounded-full pointer-events-none transition-all duration-1000 blur-3xl"
        style={{
          background: `radial-gradient(ellipse, ${rateLevel.glowColor}, transparent 70%)`,
          opacity: isProcessing ? 0.8 : 0.3,
        }}
      />

      {/* Header */}
      <div className="animate-float-up relative z-10 mb-5 sm:mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full transition-all duration-300" style={{
            backgroundColor: isProcessing ? '#00e676' : 'rgba(255,255,255,0.2)',
            boxShadow: isProcessing ? '0 0 8px rgba(0, 230, 118, 0.5)' : 'none',
          }} />
          <span className="text-[10px] sm:text-xs font-medium tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {isProcessing ? '监测中' : 'VoiceSpeed'}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>
          实时语速监测
        </h1>
      </div>

      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10">

        {/* Circular Gauge */}
        <div className="animate-float-up animate-float-up-delay-1 flex flex-col items-center mb-5 sm:mb-8">
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64">
            {/* SVG Gauge */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              {/* Background track */}
              <circle
                className="gauge-track"
                cx="100" cy="100" r={gaugeRadius}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Filled arc */}
              <circle
                className="gauge-fill"
                cx="100" cy="100" r={gaugeRadius}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                stroke={rateLevel.color}
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeOffset}
                style={{ '--gauge-glow': rateLevel.accentColor } as React.CSSProperties}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isProcessing ? (
                <>
                  {/* Sound wave visualization */}
                  <div className="flex items-end gap-[3px] h-6 sm:h-8 mb-2 sm:mb-3">
                    {waveBars.map((bar, i) => (
                      <div
                        key={i}
                        className="w-[2px] sm:w-[3px] rounded-full wave-bar"
                        style={{
                          height: `${bar.height}%`,
                          backgroundColor: rateLevel.color,
                          animationDelay: bar.delay,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                  </div>
                  <span className="stat-value text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: rateLevel.color }}>
                    {speechRate}
                  </span>
                  <span className="text-[10px] sm:text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    字/分钟
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: speechRate > 0 ? rateLevel.color : 'rgba(255,255,255,0.15)' }}>
                    {speechRate > 0 ? speechRate : '—'}
                  </span>
                  <span className="text-[10px] sm:text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    字/分钟
                  </span>
                </>
              )}
            </div>

            {/* Level badge */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide transition-all duration-500 whitespace-nowrap"
              style={{
                backgroundColor: `${rateLevel.color}15`,
                color: rateLevel.color,
                border: `1px solid ${rateLevel.color}30`,
              }}
            >
              {rateLevel.level}
            </div>
          </div>
        </div>

        {/* Record Button */}
        <div className="animate-float-up animate-float-up-delay-2 flex justify-center mb-5 sm:mb-8">
          <button
            className={`touch-target relative w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer ${
              isProcessing ? 'recording-pulse recording-glow' : ''
            }`}
            style={{
              background: isProcessing
                ? 'linear-gradient(135deg, #ff1744, #d50000)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              border: isProcessing
                ? '2px solid rgba(255, 23, 68, 0.3)'
                : '2px solid rgba(255,255,255,0.08)',
              boxShadow: isProcessing
                ? undefined
                : '0 4px 24px rgba(0,0,0,0.3)',
            }}
            onClick={isProcessing ? stopRecognition : startRecognition}
            disabled={!isInitialized || isConnecting}
            aria-label={isProcessing ? '停止录音' : '开始录音'}
          >
            {isConnecting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            ) : isProcessing ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-sm bg-white" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </button>
        </div>

        <div className="text-center mb-4 sm:mb-6">
          <span className="text-[10px] sm:text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {isConnecting ? '正在连接...' : isProcessing ? '点击停止' : '点击开始录音'}
          </span>
        </div>

        {/* Stats Grid - 2 cols on mobile, 4 cols on desktop */}
        <div className="animate-float-up animate-float-up-delay-3 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
          {/* 当前语速 */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00e5ff' }} />
              <span className="text-[10px] sm:text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>当前语速</span>
            </div>
            <div className="stat-value text-xl sm:text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {speechRate}
            </div>
            <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>字/分钟</div>
          </div>

          {/* 平均语速 */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#b388ff' }} />
              <span className="text-[10px] sm:text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>平均语速</span>
            </div>
            <div className="stat-value text-xl sm:text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {averageRate}
            </div>
            <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>字/分钟</div>
          </div>

          {/* 总字数 */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00e676' }} />
              <span className="text-[10px] sm:text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>总字数</span>
            </div>
            <div className="stat-value text-xl sm:text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {wordCount}
            </div>
            <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>字</div>
          </div>

          {/* 总时长 */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffab00' }} />
              <span className="text-[10px] sm:text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>总时长</span>
            </div>
            <div className="stat-value text-xl sm:text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {getTotalDuration()}
            </div>
            <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>elapsed</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 sm:pt-8 pb-2 text-center relative z-10 safe-area-bottom">
        <span className="text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.15)' }}>
          © {new Date().getFullYear()} VOICESPEED
        </span>
      </div>
    </div>
  );
}
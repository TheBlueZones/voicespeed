'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { RecognitionResult } from '@interfaces/SpeechRecognition';
import { VolcengineSpeechService } from './services/volcengine/VolcengineSpeechService';

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

  const speechServiceRef = useRef(new VolcengineSpeechService());
  const lastResultLengthRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

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

  // 自动滚动到识别文本底部
  useEffect(() => {
    if (transcriptRef.current && resultText) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [resultText]);

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
    if (startTimeRef.current) {
      const currentTime = Date.now();
      const currentTextLength = countChineseWords(result.text);

      totalWordCountRef.current = currentTextLength;
      setWordCount(totalWordCountRef.current);

      // 优先使用火山引擎直接返回的语速（token/s × 60 = 字/分钟）
      if (result.speechRate !== undefined && result.speechRate > 0) {
        const ratePerMinute = Math.round(result.speechRate * 60);
        setSpeechRate(ratePerMinute);
      } else {
        // fallback：用滑动窗口自己算
        setSpeechDataHistory(prev => {
          const newHistory = [...prev, { time: currentTime, textLength: totalWordCountRef.current }];
          const currentRate = calculateCurrentRate(newHistory);
          setSpeechRate(currentRate);
          return newHistory;
        });
      }

      const totalTimeMinutes = currentDurationRef.current / 60;
      if (totalTimeMinutes > 0) {
        setAverageRate(Math.round(totalWordCountRef.current / totalTimeMinutes));
      }
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
        color: '#c4bdb2',
        bgTint: 'rgba(196, 189, 178, 0.08)',
        progress: 0,
      };
    } else if (speechRate < 120) {
      return {
        level: '偏慢',
        color: '#7eb8c9',
        bgTint: 'rgba(126, 184, 201, 0.08)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else if (speechRate < 180) {
      return {
        level: '适中',
        color: '#8bba7f',
        bgTint: 'rgba(139, 186, 127, 0.08)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else if (speechRate < 250) {
      return {
        level: '较快',
        color: '#d4a054',
        bgTint: 'rgba(212, 160, 84, 0.08)',
        progress: Math.min(speechRate / 300, 1),
      };
    } else {
      return {
        level: '极速',
        color: '#c97e7e',
        bgTint: 'rgba(201, 126, 126, 0.1)',
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

  const stats = [
    { label: '当前语速', value: speechRate, unit: '字/分钟', dotColor: '#7eb8c9' },
    { label: '平均语速', value: averageRate, unit: '字/分钟', dotColor: '#c9956b' },
    { label: '总字数', value: wordCount, unit: '字', dotColor: '#8bba7f' },
    { label: '总时长', value: getTotalDuration(), unit: '', dotColor: '#d4a054' },
  ];

  if (configError) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md animate-float-up">
          <div className="soft-card rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201, 126, 126, 0.1)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#c97e7e">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>配置错误</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{configError}</p>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(201, 126, 126, 0.06)', border: '1px solid rgba(201, 126, 126, 0.1)' }}>
              <p className="text-sm" style={{ color: '#c97e7e' }}>
                请配置语音识别服务商后重试
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center px-4 py-6 sm:py-8 lg:py-10 relative overflow-hidden safe-area-top safe-area-bottom safe-area-x no-select" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="animate-float-up relative z-10 mb-6 sm:mb-8 lg:mb-10 text-center w-full">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full transition-all duration-500" style={{
            backgroundColor: isProcessing ? '#8bba7f' : 'var(--text-hint)',
          }} />
          <span className="text-[10px] sm:text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
            {isProcessing ? '监测中' : 'VoiceSpeed'}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          语速监测
        </h1>
      </div>

      {/* Main content */}
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-none split-layout relative z-10 flex-1">

        {/* ═══ Left: Gauge + Button ═══ */}
        <div className="split-left flex flex-col items-center">

          {/* Circular Gauge */}
          <div className="animate-float-up animate-float-up-delay-1 flex flex-col items-center mb-6 sm:mb-8">
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 lg:w-72 lg:h-72">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle
                  className="gauge-track"
                  cx="100" cy="100" r={gaugeRadius}
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle
                  className="gauge-fill"
                  cx="100" cy="100" r={gaugeRadius}
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke={rateLevel.color}
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                />
              </svg>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isProcessing ? (
                  <>
                    <div className="flex items-end gap-[3px] h-5 sm:h-7 lg:h-8 mb-2 sm:mb-3">
                      {waveBars.map((bar, i) => (
                        <div
                          key={i}
                          className="w-[2px] sm:w-[2.5px] rounded-full wave-bar"
                          style={{
                            height: `${bar.height}%`,
                            backgroundColor: rateLevel.color,
                            animationDelay: bar.delay,
                            opacity: 0.6,
                          }}
                        />
                      ))}
                    </div>
                    <span className="stat-value text-3xl sm:text-4xl lg:text-5xl font-medium" style={{ color: rateLevel.color }}>
                      {speechRate}
                    </span>
                    <span className="text-[10px] sm:text-xs lg:text-sm mt-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      字/分钟
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-medium" style={{ color: speechRate > 0 ? rateLevel.color : 'var(--text-hint)' }}>
                      {speechRate > 0 ? speechRate : '—'}
                    </span>
                    <span className="text-[10px] sm:text-xs lg:text-sm mt-1 font-medium" style={{ color: 'var(--text-hint)' }}>
                      字/分钟
                    </span>
                  </>
                )}
              </div>

              {/* Level badge */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide transition-all duration-500 whitespace-nowrap"
                style={{
                  backgroundColor: rateLevel.bgTint,
                  color: rateLevel.color,
                }}
              >
                {rateLevel.level}
              </div>
            </div>
          </div>

          {/* Record Button */}
          <div className="animate-float-up animate-float-up-delay-2 flex flex-col items-center mb-6 sm:mb-8 lg:mb-0">
            <button
              className={`record-btn touch-target relative w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-full flex items-center justify-center active:scale-95 ${
                isProcessing ? 'recording-active' : ''
              }`}
              style={{
                background: isProcessing
                  ? 'linear-gradient(135deg, #c97e7e, #b86e6e)'
                  : 'linear-gradient(135deg, var(--accent), #b8845e)',
                boxShadow: isProcessing
                  ? '0 4px 24px rgba(201, 126, 126, 0.2)'
                  : '0 4px 24px rgba(201, 149, 107, 0.2)',
              }}
              onClick={isProcessing ? stopRecognition : startRecognition}
              disabled={!isInitialized || isConnecting}
              aria-label={isProcessing ? '停止录音' : '开始录音'}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white/90 rounded-full animate-spin" />
              ) : isProcessing ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-[3px] bg-white" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="white" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
            </button>
            <span className="text-[10px] sm:text-xs font-medium mt-3" style={{ color: 'var(--text-tertiary)' }}>
              {isConnecting ? '正在连接...' : isProcessing ? '点击停止' : '点击开始录音'}
            </span>
          </div>
        </div>

        {/* ═══ Right: Stats + Transcript ═══ */}
        <div className="flex flex-col gap-3 sm:gap-4">

          {/* Stats Grid */}
          <div className="animate-float-up animate-float-up-delay-3 grid grid-cols-2 gap-2.5 sm:gap-3">
            {stats.map((s) => (
              <div key={s.label} className="soft-card rounded-2xl p-3.5 sm:p-4 lg:p-5">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dotColor }} />
                  <span className="text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{s.label}</span>
                </div>
                <div className="stat-value text-xl sm:text-2xl lg:text-3xl font-medium" style={{ color: 'var(--text-primary)' }}>
                  {s.value}
                </div>
                {s.unit && (
                  <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium" style={{ color: 'var(--text-hint)' }}>{s.unit}</div>
                )}
              </div>
            ))}
          </div>

          {/* Transcript area */}
          <div className="animate-float-up animate-float-up-delay-4 soft-card rounded-2xl p-4 sm:p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-hint)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--text-hint)' }}>识别文本</span>
            </div>
            <div
              ref={transcriptRef}
              className="transcript-area overflow-y-auto text-sm sm:text-base leading-relaxed min-h-[80px] max-h-[160px] sm:max-h-[200px] lg:max-h-[320px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {resultText ? (
                <span className={isProcessing ? 'transcript-cursor' : ''}>
                  {resultText}
                </span>
              ) : (
                <span style={{ color: 'var(--text-hint)' }}>
                  {isProcessing ? '正在聆听...' : '录音后将在此显示识别文本'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 sm:pt-8 pb-2 text-center relative z-10 safe-area-bottom">
        <span className="text-[10px] tracking-wider font-medium" style={{ color: 'var(--text-hint)' }}>
          © {new Date().getFullYear()} VOICESPEED
        </span>
      </div>
    </div>
  );
}
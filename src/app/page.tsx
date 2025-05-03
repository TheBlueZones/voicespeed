'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  
  // 页面加载时自动重定向到语速检测页面
  useEffect(() => {
    router.push('/voice-speed');
  }, [router]);

  // 仍然保留原页面内容，以防重定向失败或用户通过返回按钮回到首页
  return (
    <div className="container mx-auto p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">语音速录系统</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        <Link href="/voice-recognition">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-4">实时语音听写</h2>
            <p className="text-gray-600">
              使用麦克风进行实时语音识别，自动将您的语音转换为文字。
            </p>
          </div>
        </Link>
        
        <Link href="/file-recognition">
          <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-4">语音文件听写</h2>
            <p className="text-gray-600">
              上传音频文件，将录制好的语音内容转换为文字。
            </p>
          </div>
        </Link>
        
        <Link href="/voice-recognition2">
          <div className="bg-blue-50 shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-blue-200">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">实时语速监测 <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">新</span></h2>
            <p className="text-gray-600">
              使用麦克风进行实时语音识别，并监测您的语速和语音模式，提供统计分析。
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

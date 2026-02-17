import { NextResponse } from 'next/server';

export async function POST() {
  // Mock: 返回一个假的 token
  // 以后替换为真实的服务商签名逻辑
  return NextResponse.json({ url: 'mock://speech-service', token: 'mock-token' });
}

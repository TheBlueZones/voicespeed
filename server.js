// Polyfill: Node.js 22+ 有实验性 localStorage 但 getItem 不是标准函数，
// Next.js dev overlay 在 SSR 时会调用 localStorage.getItem 导致崩溃
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket: WsWebSocket } = require('ws');
const { gzipSync, gunzipSync } = require('zlib');
const { randomUUID } = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ─── 火山引擎协议 ───

const VOLCENGINE_WS_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';

function buildAuthHeaders(appKey, accessKey) {
  return {
    'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
    'X-Api-Request-Id': randomUUID(),
    'X-Api-Access-Key': accessKey,
    'X-Api-App-Key': appKey,
  };
}

function buildHeader(messageType, flags) {
  const buf = Buffer.alloc(4);
  buf[0] = (0b0001 << 4) | 1; // version | header_size
  buf[1] = (messageType << 4) | flags;
  buf[2] = (0b0001 << 4) | 0b0001; // JSON | GZIP
  buf[3] = 0x00;
  return buf;
}

function buildFullClientRequest(seq) {
  const header = buildHeader(0b0001, 0b0001); // FULL_REQUEST, POS_SEQ
  const payload = {
    user: { uid: 'voicespeed_user' },
    audio: { format: 'raw', codec: 'raw', rate: 16000, bits: 16, channel: 1 },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: true,
      show_utterances: true,
      show_speech_rate: true,
      enable_nonstream: false,
    },
  };
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const result = Buffer.alloc(4 + 4 + 4 + compressed.length);
  header.copy(result, 0);
  result.writeInt32BE(seq, 4);
  result.writeUInt32BE(compressed.length, 8);
  compressed.copy(result, 12);
  return result;
}

function buildAudioRequest(seq, audioData, isLast) {
  const flags = isLast ? 0b0011 : 0b0001;
  const header = buildHeader(0b0010, flags); // AUDIO_ONLY
  const actualSeq = isLast ? -seq : seq;
  const compressed = gzipSync(audioData);
  const result = Buffer.alloc(4 + 4 + 4 + compressed.length);
  header.copy(result, 0);
  result.writeInt32BE(actualSeq, 4);
  result.writeUInt32BE(compressed.length, 8);
  compressed.copy(result, 12);
  return result;
}

function parseResponse(msg) {
  const response = { code: 0, isLast: false, sequence: 0, payload: null };
  const buf = Buffer.from(msg);
  const headerSize = buf[0] & 0x0f;
  const messageType = buf[1] >> 4;
  const messageFlags = buf[1] & 0x0f;
  const compression = buf[2] & 0x0f;

  let offset = headerSize * 4;

  if (messageFlags & 0x01) { response.sequence = buf.readInt32BE(offset); offset += 4; }
  if (messageFlags & 0x02) { response.isLast = true; }
  if (messageFlags & 0x04) { offset += 4; }

  if (messageType === 0b1001) { // SERVER_FULL_RESPONSE
    const payloadSize = buf.readUInt32BE(offset); offset += 4;
    if (payloadSize > 0) {
      let payload = buf.subarray(offset, offset + payloadSize);
      if (compression === 0b0001) payload = gunzipSync(payload);
      response.payload = JSON.parse(payload.toString('utf-8'));
    }
  } else if (messageType === 0b1111) { // SERVER_ERROR
    response.code = buf.readInt32BE(offset); offset += 4;
    const payloadSize = buf.readUInt32BE(offset); offset += 4;
    if (payloadSize > 0) {
      let payload = buf.subarray(offset, offset + payloadSize);
      if (compression === 0b0001) payload = gunzipSync(payload);
      response.payload = JSON.parse(payload.toString('utf-8'));
    }
  }
  return response;
}

// ─── 启动服务器 ───

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url, true);
    if (pathname === '/api/speech/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (client) => {
    const appKey = process.env.VOLCENGINE_APP_KEY;
    const accessKey = process.env.VOLCENGINE_ACCESS_KEY;

    if (!appKey || !accessKey) {
      client.send(JSON.stringify({ type: 'error', message: '服务端未配置语音识别凭证' }));
      client.close();
      return;
    }

    let seq = 1;
    let isConnected = false;

    const headers = buildAuthHeaders(appKey, accessKey);
    const upstream = new WsWebSocket(VOLCENGINE_WS_URL, { headers });

    upstream.on('open', () => {
      console.log('[proxy] 已连接火山引擎');
      const fullRequest = buildFullClientRequest(seq);
      seq++;
      upstream.send(fullRequest);
    });

    upstream.on('message', (data) => {
      const response = parseResponse(Buffer.from(data));

      if (response.code !== 0) {
        console.error('[proxy] 火山引擎错误:', response.payload);
        client.send(JSON.stringify({ type: 'error', message: '语音识别服务错误', detail: response.payload }));
        return;
      }

      if (!isConnected) {
        isConnected = true;
        client.send(JSON.stringify({ type: 'ready' }));
        return;
      }

      if (response.payload) {
        client.send(JSON.stringify({ type: 'result', payload: response.payload, isLast: response.isLast }));
      }

      if (response.isLast) {
        console.log('[proxy] 识别完成');
      }
    });

    upstream.on('error', (err) => {
      console.error('[proxy] 火山引擎连接错误:', err.message);
      client.send(JSON.stringify({ type: 'error', message: '语音识别连接失败' }));
    });

    upstream.on('close', () => {
      console.log('[proxy] 火山引擎连接关闭');
      if (client.readyState === WsWebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'closed' }));
      }
    });

    client.on('message', (data) => {
      if (!upstream || upstream.readyState !== WsWebSocket.OPEN) return;

      try {
        const str = data.toString('utf-8');
        if (str.startsWith('{')) {
          const msg = JSON.parse(str);
          if (msg.type === 'stop') {
            const lastPacket = buildAudioRequest(seq, Buffer.alloc(0), true);
            upstream.send(lastPacket);
            return;
          }
        }
      } catch {}

      if (!isConnected) return;

      const audioPacket = buildAudioRequest(seq, Buffer.from(data), false);
      seq++;
      upstream.send(audioPacket);
    });

    client.on('close', () => {
      console.log('[proxy] 前端断开连接');
      if (upstream && upstream.readyState === WsWebSocket.OPEN) {
        try {
          const lastPacket = buildAudioRequest(seq, Buffer.alloc(0), true);
          upstream.send(lastPacket);
        } catch {}
        setTimeout(() => upstream?.close(), 500);
      }
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

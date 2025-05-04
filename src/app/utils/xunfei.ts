// 语音识别工具模块

// 环境变量 - 实际使用时需要替换成真实的值
const APPID = "YOUR_APPID";
const API_KEY = "YOUR_API_KEY";
const API_SECRET = "YOUR_API_SECRET";

/**
 * 获取讯飞语音识别WebSocket的URL
 */
export function getWebSocketUrl() {
  // 请求地址根据语种不同变化
  const url = "wss://iat-api.xfyun.cn/v2/iat";
  const host = "iat-api.xfyun.cn";
  const date = new Date().toUTCString();
  const algorithm = "hmac-sha256";
  const headers = "host date request-line";
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  
  // 注意：这部分需要在客户端运行，依赖于动态导入的CryptoJS
  let signature = '';
  let authorization = '';
  
  if (typeof window !== 'undefined') {
    // @ts-expect-error - CryptoJS是动态加载的全局变量
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, API_SECRET);
    // @ts-expect-error - CryptoJS是动态加载的全局变量
    signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${API_KEY}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    authorization = btoa(authorizationOrigin);
  }
  
  return `${url}?authorization=${authorization}&date=${date}&host=${host}`;
}

/**
 * 将ArrayBuffer转换为Base64字符串
 */
export function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * 解析识别结果
 */
export function parseRecognitionResult(resultData: string, prevText: string, prevTextTemp: string) {
  let resultText = prevText;
  let resultTextTemp = prevTextTemp;
  
  // 识别结果解析
  const jsonData = JSON.parse(resultData);
  if (jsonData.data && jsonData.data.result) {
    const data = jsonData.data.result;
    let str = "";
    const ws = data.ws;
    for (let i = 0; i < ws.length; i++) {
      str = str + ws[i].cw[0].w;
    }
    
    // 开启wpgs会有此字段(前提：在控制台开通动态修正功能)
    // 取值为 "apd"时表示该片结果是追加到前面的最终结果；取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
    if (data.pgs) {
      if (data.pgs === "apd") {
        // 将resultTextTemp同步给resultText
        resultText = resultTextTemp;
      }
      // 将结果存储在resultTextTemp中
      resultTextTemp = resultText + str;
    } else {
      resultText = resultText + str;
    }
  }
  
  return {
    resultText,
    resultTextTemp,
    jsonData
  };
}

/**
 * 讯飞语音识别参数配置
 */
export const recognitionParams = {
  common: {
    app_id: APPID,
  },
  business: {
    language: "zh_cn",
    domain: "iat",
    accent: "mandarin",
    vad_eos: 5000,
    dwa: "wpgs",
  },
  data: {
    status: 0,
    format: "audio/L16;rate=16000",
    encoding: "raw",
  },
}; 
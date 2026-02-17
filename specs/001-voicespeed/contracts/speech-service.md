# Speech Service Contract

## 架构

```
浏览器 → Next.js API Route（/api/speech） → 语音服务商
```

API Key 只存在服务端环境变量中，前端不接触凭证。

## API Route: /api/speech

### POST /api/speech/token

获取语音识别的连接凭证（由服务端生成签名 URL 或临时 token）。

- **输入**: 无（服务端从环境变量读取凭证）
- **输出**: `{ url: string }` 已签名的 WebSocket 连接地址
- **错误**: `{ error: string }` 凭证未配置或签名失败

## 前端接口

### SpeechRecognitionService

语音识别服务的统一接口，所有服务商实现必须遵循此契约。

#### initialize()

初始化服务，从 API Route 获取连接凭证。

- **输出**: `Promise<boolean>` 是否初始化成功

#### startRealTimeRecognition(options)

开始实时语音识别。

- **输入**: options 对象
  - `onResult(result: RecognitionResult)`: 识别结果回调
  - `onError(error: Error)`: 错误回调
  - `onStart()`: 开始录音回调
  - `onStop()`: 停止录音回调
- **输出**: `Promise<void>`

#### stopRealTimeRecognition()

停止实时语音识别。

- **输出**: `void`

#### dispose()

释放资源，断开连接。

- **输出**: `void`

### SpeechRecognitionFactory

#### createService(vendor: string)

根据服务商标识创建服务实例。

- **输入**: 服务商标识字符串
- **输出**: `SpeechRecognitionService` 实例
- **异常**: 不支持的服务商抛出 Error

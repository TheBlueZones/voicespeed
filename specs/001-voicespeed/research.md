# Research: VoiceSpeed 实时语速监测

## 1. 语音识别服务商选择

**Decision**: 通过工厂模式支持多服务商，首个实现待定

**Rationale**: 项目架构已有 `SpeechRecognitionService` 接口和 `SpeechRecognitionFactory`，新增服务商只需实现接口并注册到工厂。

**Alternatives considered**:
- 讯飞 IAT：国内中文识别准确率高，WebSocket API
- Web Speech API：浏览器原生，免费但兼容性有限
- 百度语音：国内服务商，REST API
- Azure Speech：微软云服务，WebSocket API

## 2. 音频采集方案

**Decision**: Web Audio API + AudioWorklet

**Rationale**: AudioWorklet 在独立线程处理音频，不阻塞主线程。ScriptProcessorNode 已被标记为废弃。

**Alternatives considered**:
- MediaRecorder API：简单但无法控制采样率和编码格式
- ScriptProcessorNode：已废弃，在主线程运行会造成卡顿

## 3. 语速计算算法

**Decision**: 滑动窗口 + 累计平均双模式

**Rationale**: 滑动窗口（10 秒）反映当前说话速度变化，累计平均反映整体语速。两者结合给用户更完整的信息。

**Alternatives considered**:
- 仅累计平均：无法反映实时变化
- 仅固定窗口：窗口边界处数据不连续

## 4. API 凭证管理架构

**Decision**: Next.js API Routes 做服务端中转

**Rationale**: API Key 不能暴露在浏览器端。通过 Next.js API Route（`/api/speech/token`）在服务端生成签名 URL，前端拿到签名 URL 后直连语音服务商 WebSocket。这样凭证只存在服务端环境变量中。

**Alternatives considered**:
- 前端直连服务商：API Key 暴露在浏览器，有安全风险
- 独立后端服务：增加部署复杂度，Next.js 自带 API Routes 足够用

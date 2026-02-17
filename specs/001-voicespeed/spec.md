# Feature Specification: VoiceSpeed — 实时语速监测

**Feature Branch**: `001-voicespeed`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "VoiceSpeed 实时语速监测"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 实时语速监测 (Priority: P1)

用户打开主页，点击"开始录音"按钮，系统通过麦克风采集语音并实时识别为文字，同时计算当前语速（字/分钟）并显示语速等级。用户可以随时点击"停止"结束监测。

**Why this priority**: 这是产品的核心价值——帮助用户了解自己的说话速度，是 MVP 的最小可交付单元。

**Independent Test**: 打开主页，点击开始录音，对着麦克风说一段话，观察语速数值和等级是否实时更新。

**Acceptance Scenarios**:

1. **Given** 用户在主页且已授权麦克风, **When** 点击"开始录音", **Then** 系统开始采集语音并在 2 秒内显示第一个语速数值
2. **Given** 用户正在录音, **When** 持续说话, **Then** 语速数值实时更新，并显示对应等级（偏慢/适中/较快/非常快）
3. **Given** 用户正在录音, **When** 点击"停止", **Then** 录音停止，最终语速数值保留在页面上
4. **Given** 用户未授权麦克风, **When** 点击"开始录音", **Then** 显示清晰的中文提示引导用户授权

---

### Edge Cases

- 用户在录音过程中切换浏览器标签页或最小化窗口时，录音如何处理？
- 网络断开导致 WebSocket 连接中断时，如何提示用户？
- 用户快速连续点击开始/停止按钮时，系统是否能正确处理状态切换？
- 麦克风被其他应用占用时，如何提示用户？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 通过浏览器麦克风采集音频
- **FR-002**: 系统 MUST 将采集的音频发送至语音识别服务并接收识别结果
- **FR-003**: 系统 MUST 根据识别出的文字数量和时间间隔计算语速（字/分钟）
- **FR-004**: 系统 MUST 将语速映射为四个等级：偏慢（<120）、适中（120-180）、较快（180-250）、非常快（≥250）
- **FR-005**: 系统 MUST 在所有错误场景下显示中文提示信息
- **FR-006**: 系统 MUST 在录音状态变化时提供即时视觉反馈

### Key Entities

- **RecognitionResult**: 单次识别返回的文字内容，包含是否为最终结果的标记
- **SpeechSpeed**: 语速计算结果，包含字数、时长、每分钟字数、语速等级

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户从点击"开始录音"到看到第一个语速数值，延迟不超过 2 秒
- **SC-002**: 所有错误场景均有对应的中文提示，用户无需查看控制台即可理解问题
- **SC-003**: 语速等级划分准确反映实际说话速度

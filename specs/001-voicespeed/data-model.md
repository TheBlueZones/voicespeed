# Data Model: VoiceSpeed 实时语速监测

## RecognitionResult

语音识别服务返回的单次识别结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 识别出的文字内容 |
| isFinished | boolean | 是否为最终结果（非中间结果） |

## SpeechSpeed

语速计算结果，由前端根据识别结果实时计算。

| 字段 | 类型 | 说明 |
|------|------|------|
| currentRate | number | 当前语速（字/分钟），滑动窗口计算 |
| averageRate | number | 平均语速（字/分钟），累计计算 |
| wordCount | number | 累计总字数 |
| duration | number | 累计时长（秒） |
| level | string | 语速等级：偏慢/适中/较快/非常快 |

## 语速等级映射

| 等级 | 范围（字/分钟） |
|------|-----------------|
| 偏慢 | < 120 |
| 适中 | 120 - 180 |
| 较快 | 180 - 250 |
| 非常快 | ≥ 250 |

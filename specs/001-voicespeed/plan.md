# Implementation Plan: VoiceSpeed 实时语速监测

**Branch**: `001-voicespeed` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-voicespeed/spec.md`

## Summary

实现实时语速监测功能：用户点击录音按钮，系统通过麦克风采集语音，调用语音识别服务将语音转为文字，实时计算语速（字/分钟）并显示语速等级。语音识别服务通过工厂模式接入，支持切换不同服务商。

## Technical Context

**Language/Version**: TypeScript 5 + React 19
**Primary Dependencies**: Next.js 15 (App Router), Tailwind CSS 4
**Storage**: N/A（无持久化）
**Testing**: N/A
**Target Platform**: 现代浏览器（Chrome, Edge, Firefox）
**Project Type**: web（前端 + Next.js API Routes 后端）
**Performance Goals**: 语音到语速数值显示延迟 ≤ 2 秒
**Constraints**: API Key 只存服务端，前端不接触凭证
**Scale/Scope**: 单页面应用，1 个核心页面 + 1 个 API Route

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 工厂模式 | ✅ 通过 | 语音识别通过工厂类接入 |
| II. 接口驱动 | ✅ 通过 | 页面依赖统一接口 |
| III. 简洁至上 | ✅ 通过 | 只实现语速监测一个功能 |
| IV. 用户体验优先 | ✅ 通过 | 错误提示使用中文 |

## Project Structure

### Documentation (this feature)

```text
specs/001-voicespeed/
├── plan.md              # 本文件
├── research.md          # Phase 0: 技术调研
├── data-model.md        # Phase 1: 数据模型
├── quickstart.md        # Phase 1: 快速验证指南
├── contracts/           # Phase 1: 接口契约
│   └── speech-service.md
└── tasks.md             # Phase 2: 任务列表（/speckit.tasks 生成）
```

### Source Code (repository root)

```text
src/app/
├── api/
│   └── speech/
│       └── token/
│           └── route.ts            # API Route: 生成签名 URL
├── interfaces/
│   └── SpeechRecognition.ts        # 统一接口定义
├── services/
│   └── SpeechRecognitionFactory.ts  # 工厂类
├── page.tsx                        # 主页（语速监测）
├── layout.tsx                      # 全局布局
└── globals.css                     # 全局样式
```

**Structure Decision**: 使用 Next.js App Router 结构，前端页面和 API Route 共存于 `src/app/` 下。API Route 负责服务端凭证管理，前端通过接口调用获取签名 URL 后直连语音服务商 WebSocket。

## Complexity Tracking

无违规，无需额外说明。

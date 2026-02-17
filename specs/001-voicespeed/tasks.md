# Tasks: VoiceSpeed 实时语速监测

**Input**: Design documents from `/specs/001-voicespeed/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create API route directory structure at `src/app/api/speech/token/`
- [ ] T002 [P] Update `SpeechRecognition.ts` interface to remove config parameter from `initialize()` (凭证改为服务端获取) at `src/app/interfaces/SpeechRecognition.ts`
- [ ] T003 [P] Update `SpeechRecognitionFactory.ts` to support vendor registration at `src/app/services/SpeechRecognitionFactory.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API Route 和核心服务基础设施，必须在 US1 之前完成

- [ ] T004 Implement `/api/speech/token` API Route: 从服务端环境变量读取凭证，生成签名 URL 返回给前端 at `src/app/api/speech/token/route.ts`
- [ ] T005 Define environment variables for speech service credentials (non-NEXT_PUBLIC_) in `.env.local`

**Checkpoint**: API Route 可用，前端可通过 `/api/speech/token` 获取签名 URL

---

## Phase 3: User Story 1 - 实时语速监测 (Priority: P1)

**Goal**: 用户点击录音按钮，系统实时识别语音并计算语速，显示语速等级

**Independent Test**: 打开主页，点击开始录音，说一段话，观察语速数值和等级是否实时更新

### Implementation for User Story 1

- [ ] T006 [US1] Implement first speech vendor service (调用 `/api/speech/token` 获取签名 URL，建立 WebSocket 连接，采集音频并发送) at `src/app/services/<vendor>/`
- [ ] T007 [US1] Register vendor in factory and add to `SpeechVendor` enum at `src/app/services/SpeechRecognitionFactory.ts`
- [ ] T008 [US1] Update main page to initialize speech service via factory (替换当前的 configError 占位逻辑) at `src/app/page.tsx`
- [ ] T009 [US1] Implement audio capture using Web Audio API + AudioWorklet at `src/app/services/<vendor>/` or shared audio utils
- [ ] T010 [US1] Wire up recognition results to speech rate calculation (当前页面已有滑动窗口和累计平均算法) at `src/app/page.tsx`
- [ ] T011 [US1] Handle error states: microphone denied, WebSocket failure, network disconnect with Chinese error messages at `src/app/page.tsx`

**Checkpoint**: 主页语速监测功能完整可用

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 优化和边界情况处理

- [ ] T012 Handle edge case: rapid start/stop button clicks (debounce) at `src/app/page.tsx`
- [ ] T013 Handle edge case: browser tab switch during recording at `src/app/page.tsx`
- [ ] T014 Remove unused pages (`voice-recognition/`, `file-recognition/`) and related code
- [ ] T015 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS US1
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **Polish (Phase 4)**: Depends on US1 being complete

### Within User Story 1

- T006 (vendor service) depends on T004 (API Route)
- T007 (factory registration) depends on T006
- T008 (page integration) depends on T007
- T009 (audio capture) can parallel with T006 if in separate files
- T010 (wire up results) depends on T008
- T011 (error handling) depends on T008

### Parallel Opportunities

```bash
# Phase 1: All setup tasks in parallel
Task: T002 "Update SpeechRecognition.ts interface"
Task: T003 "Update SpeechRecognitionFactory.ts"

# Phase 2: After T004 completes
Task: T004 "API Route" → then T005 "env vars" (sequential)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (API Route)
3. Complete Phase 3: User Story 1 (语速监测)
4. **STOP and VALIDATE**: Test speech rate monitoring end-to-end
5. Complete Phase 4: Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label maps task to User Story 1
- Verify each phase checkpoint before proceeding
- Commit after each task or logical group
- Vendor implementation (T006) requires choosing a specific speech service provider first

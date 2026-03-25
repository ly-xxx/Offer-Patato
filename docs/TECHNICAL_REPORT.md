# Technical Report

[English Version](./TECHNICAL_REPORT.en.md)

## 1. 项目定位

OfferLoom 不是一个“把题库堆在网页上”的普通面试站，也不是一个通用型多智能体平台。

它更准确的定位是：

- 一个以主线学习文档为核心的面试准备工作台
- 一个把题库、主线知识和个人工作材料编织到同一条证据链里的 RAG 应用
- 一个把 `codex-cli` 变成站内受管执行层的文档站

它要解决的是四个实际问题：

1. 用户知道很多题，但不知道题到底对应哪一个知识点。
2. 用户会讲项目，但很难把项目经验和基础知识题建立诚实、可回溯的联系。
3. 用户希望既能批量生成高质量答案，又能在站内继续用 agent 做局部追问、改写和文件协作。
4. 公开发布时必须严格区分公开底座和私有 `mywork`，不能把个人信息和本地路径混进发布版。

## 2. 系统边界

在实现上，OfferLoom 当前是一个“单服务端 + SQLite + Web 前端 + 本机 Codex 执行层”的系统。

这里需要明确一个边界：

- 它**有多个受管 agent 角色**
- 但这些 agent 是**产品级任务代理 / 作业执行器**
- 它**不是**一个内部再套一个 planner / executor / critic swarm 的复杂多智能体框架

也就是说，OfferLoom 目前的 agent 设计是“按产品任务拆职责”，而不是“在一次回答里内部再编排多个 autonomous sub-agents”。

## 3. 总体架构

可以把系统拆成五层：

```text
┌─────────────────────────────────────────────────────────────┐
│ Web UI                                                     │
│ 文档站 / 面经 tab / mywork tab / 设置 / 任务中心 / Codex 浮窗 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ HTTP + WebSocket Service                                   │
│ /api/* /ws/codex /ws/watch                                 │
│ Express + ws + job managers                                │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼────────────────┬──────────────────┐
          ▼               ▼                ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Index Agent    │ │ Answer Agent   │ │ Console Agent  │ │ PTY Runtime    │
│ build-db       │ │ answer package │ │ managed codex  │ │ interactive CLI│
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
          │               │                │                  │
          ▼               ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│ SQLite + Generated Files + Runtime Config                  │
│ documents / sections / questions / links / work / answers  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Sources + mywork + manual imports + codex-cli              │
│ 本地目录 / Git 仓库 / OCR 导入 / 工作材料 / Codex 执行       │
└─────────────────────────────────────────────────────────────┘
```

## 4. 我们构造了哪些 Agent

当前代码里，真正落地的 agent 角色主要有四类。

### 4.1 索引 Agent

实现位置：

- `server/lib/indexer.ts`
- 对外入口：`POST /api/index/jobs`

核心职责：

- 保存运行时来源配置
- 同步 Git 来源或读取本地来源
- 调用 `scripts/build-db.mjs` 重建索引
- 先写入临时数据库，再热切换到正式数据库
- 向前端持续汇报阶段、日志和进度

它是一个“构建型 agent”，不是直接回答问题，而是负责把站点的知识底座重建出来。

阶段状态大致是：

- `writing_config`
- `syncing_sources`
- `building_index`
- `swapping_database`
- `ready`

它的一个关键工程点是热切换：

- 索引不是直接覆盖线上数据库
- 而是先构建 `tempDbPath`
- 构建成功后才替换 live DB
- 这样前端不会在构建中间态读到半成品数据

### 4.2 个性化答案 Agent

实现位置：

- `server/lib/codex.ts`
- 类：`AnswerJobManager`
- 对外入口：`POST /api/generated`

核心职责：

- 读取题目详情
- 收集主线知识锚点
- 收集 `mywork` 的 direct / adjacent 证据
- 合并显式选中的文档引用
- 拼出受 skills 约束的 prompt
- 调用 `codex exec`
- 用 JSON schema 约束输出
- 将结果写回数据库和 `data/generated/`

它的定位不是“自由聊天”，而是“稳定地产出结构化面试答案包”。

这个 agent 的输出必须满足 `schemas/answer-package.schema.json`，核心字段包括：

- `elevator_pitch`
- `full_answer_markdown`
- `work_story`
- `work_evidence_status`
- `work_evidence_note`
- `knowledge_map`
- `citations`
- `follow_ups`
- `missing_basics`

这使得前端可以把同一份结果拆成：

- 20 秒开场
- 完整回答
- 项目切入
- 知识骨架
- 反向引用
- 后续追问

### 4.3 受管 Codex Console Agent

实现位置：

- `server/lib/codex.ts`
- 类：`ManagedCodexConsoleManager`
- 对外入口：`POST /api/codex-console/jobs`

这是站内最像“文档 copilot”的 agent。

它的职责是：

- 接收用户在浮窗里的自然语言消息
- 拼接最近对话历史
- 自动附加当前打开文档
- 追加用户手选文件
- 追加用户手选项目目录摘要
- 调用 `codex exec`
- 按 `schemas/codex-console.schema.json` 产出结构化回复

这个 agent 更偏“面向交互”而不是“面向批量生成”。

它可以做的事情包括：

- 解释当前文档
- 根据当前章节补充回答
- 审阅某个文件
- 直接修改选中文件
- 产出简洁的聊天风格回答，同时列出改动文件和引用来源

它的输出字段包括：

- `mode`
- `headline`
- `summary`
- `reply_markdown`
- `warnings`
- `changed_files`
- `citations`
- `follow_ups`

### 4.4 交互式 PTY Codex Runtime

实现位置：

- `server/lib/codex.ts` 中的 `attachCodexPty`
- `scripts/codex_pty_bridge.py`
- WebSocket：`/ws/codex`

这部分不是 JSON schema 约束的批处理 agent，而是真正的“终端型 agent runtime”。

它的工作方式是：

1. 前端通过 websocket 发 `start / input / resize`
2. 服务端起一个 Python PTY bridge
3. bridge 再起真实的 `codex` 进程
4. stdout / stderr 被桥接回浏览器
5. 用户在浏览器里获得可拖动、可折叠、可 resize 的本机 Codex 终端

这条链路的价值在于：

- 保留 `codex-cli` 的真实交互能力
- 同时又让站内可以管理模型、effort、文档引用和实时文件刷新

### 4.5 非 LLM 辅助 Worker

除了上面四个主要 agent / runtime，系统里还有两个很重要的辅助 worker：

1. 面经导入 Worker
   前端在 `InterviewImportModal` 里支持粘贴文本或截图 OCR，截图模式用 `tesseract.js` 在浏览器侧识别文本，再通过 `POST /api/questions/import` 写成新的 markdown 源文件。
2. 文件监听 Worker
   `server/index.ts` 里通过 `/ws/watch` 建立文件监听，当前文档一旦被 Codex 修改，浏览器就能立即收到 `changed` 事件并刷新状态。

## 5. 我们写了哪些 Skills

仓库内目前有 6 个 prompt skill 文件，路径都在 `skills/` 下。

### 5.1 当前运行时直接加载的 Skills

#### `answer-composer.md`

用途：

- 规定个性化答案包的结构和质量要求
- 强制输出面试可说的中文答案，而不是教材式堆砌
- 要求显式给出 `direct / adjacent / none`

使用位置：

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `mywork-triage.md`

用途：

- 约束模型如何判断 `mywork` 是否真的与问题相关
- 强调“如果不相关就及时止损”
- 把相关性分成 `direct / adjacent / none`

使用位置：

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `project-interviewer.md`

用途：

- 让模型以面试官视角看待项目
- 逼出“项目开场、最硬贡献、薄弱点、追问方向、tradeoff”

使用位置：

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `codex-console.md`

用途：

- 规范受管 console 的回答风格
- 要求在聊天场景中既保持简洁，又保留引用、告警和改动摘要
- 让站内 Codex 浮窗更像“文档协作助手”

使用位置：

- `server/lib/codex.ts`

### 5.2 当前仓库内已编写、但还没有在主运行链路里自动加载的 Skills

#### `question-linker.md`

定位：

- 面向“题目到主线知识锚点”的精确链接

当前状态：

- 已写成 prompt 资产
- 但当前 linking 主逻辑仍在 `scripts/build-db.mjs` 的启发式 / hybrid 打分里
- 还没有单独把这份 skill 作为一个额外 LLM linking step 串进建库流程

#### `work-summarizer.md`

定位：

- 面向单项目摘要提炼

当前状态：

- 已写成 prompt 资产
- 但当前项目摘要主要由 `server/lib/projectPrep.ts` 里的规则化抽取完成
- 还没有在主链路中额外起一个 LLM summarization pass

### 5.3 这些 Skills 的真实作用

OfferLoom 里的 skill 不是“插件系统”，而是“稳定 prompt 结构”的规范层。

它们的作用是：

- 把不同 agent 的职责显式写清
- 限制模型输出结构
- 降低每次 prompt 都从零临场拼装导致的漂移

换句话说，当前技能体系本质上是：

- 一组被代码按场景加载的 prompt contracts
- 而不是一个外部可动态装配的通用 skill runtime

## 6. OfferLoom 和 `codex-cli` 是怎么协作的

这是整个项目最关键的一层。

当前与 `codex-cli` 的协作一共分成三种模式。

### 6.1 Schema-Constrained Batch 模式

用于：

- 题目翻译
- 个性化答案生成
- 受管 console 的结构化回复

典型调用形式是：

```text
codex exec
  --skip-git-repo-check
  --cd <ROOT_DIR>
  --output-schema <schema.json>
  --output-last-message <outputFile>
  -m <model>
  -c model_reasoning_effort="<effort>"
  -
```

特点：

- prompt 通过 stdin 喂给 `codex`
- 输出被 schema 强约束
- 服务端只接收最后一条结构化消息
- 适合批处理和持久化

这就是为什么：

- 答案生成可以直接落库
- console 回复可以稳定渲染
- 前端能可靠区分 `citations`、`warnings`、`changed_files`

### 6.2 受管 Console 模式

在这个模式里，OfferLoom 不只是把一条用户消息丢给 Codex。

它会额外注入：

- 最近对话历史
- 当前文档
- 用户显式选中的文件
- 用户显式选中的项目目录摘要
- `codex-console.md` 约束

所以这个模式本质上是：

- `codex-cli` 负责真正推理和改文件
- OfferLoom 负责上下文注入、任务治理和结果结构化

### 6.3 真终端 PTY 模式

这里不是 `codex exec`，而是直接起真实的 CLI 会话。

PTY bridge 实际启动的命令形态接近：

```text
codex
  --cd <ROOT_DIR>
  --no-alt-screen
  -a never
  -s danger-full-access
  -m <model>
  -c model_reasoning_effort="<effort>"
```

这个模式保留了 CLI 的原生交互体验：

- 流式输出
- 按键输入
- 动态 resize
- 真正的终端语义

但浏览器层额外提供：

- 模型和 effort 切换
- 自动引用当前文档
- 搜索文件并注入引用
- 当前文档文件变更后的即时刷新

### 6.4 为什么我们同时保留两条 Codex 链路

因为它们解决的是两类不同问题：

1. `codex exec + schema`
   适合稳定、结构化、可持久化的任务
2. `PTY + interactive codex`
   适合开放探索、即兴追问、长链修改和终端协作

这两条链路不是重复，而是互补。

## 7. 数据如何流动

### 7.1 首次启动的数据流

首次启动的主链路是：

```text
config/sources.json
   ↓
自动发现 sources/documents/* 和 sources/question-banks/*
   ↓
bootstrap.mjs 同步 Git 来源（如果配置为 git）
   ↓
build-db.mjs 读取主线 / 题库 / mywork
   ↓
构建 SQLite + FTS + links
   ↓
前端通过 /api/meta /api/documents /api/questions 读取
```

### 7.2 建库数据流

`scripts/build-db.mjs` 的主流程可以概括成 6 步：

1. 读取来源配置与翻译缓存
2. 解析 guide / question bank / mywork
3. 规范化文档、切 section、抽问题、扫描项目、切 work chunk
4. 可选地构建 embeddings
5. 计算 question 与 guide / work 的 link
6. 写 SQLite、FTS、`app_meta`

构建过程中会持续产出进度事件，例如：

- `sources`
- `mywork_scan`
- `embedding_prepare`
- `embedding_run`
- `linking`
- `finalize`
- `done`

这些事件被 Index Agent 转成前端进度条和日志。

### 7.3 翻译数据流

题目翻译走 `scripts/batch-translate-questions.mjs`：

```text
questions
   ↓
按 batch 送给 codex exec
   ↓
按 question-translation schema 取回结果
   ↓
回写 questions.metadata_json.translatedText
   ↓
更新 questions_fts
   ↓
保存 translation cache
```

在发布版的一键脚本里，默认会预翻译题目，便于中文阅读。

### 7.4 个性化答案数据流

当用户点击“生成个性化答案”时，链路是：

```text
Question ID
   ↓
db.getQuestion()
   ↓
拿到 guideMatches / guideFallbackMatches / workMatches / workHintMatches
   ↓
附加当前文档与显式选中文档
   ↓
加载 skills: answer-composer + mywork-triage + project-interviewer
   ↓
codex exec + answer schema
   ↓
generated_answers 落库
   ↓
data/generated/<questionId>.json 落文件
   ↓
前端轮询 job 状态并渲染
```

### 7.5 受管 Console 数据流

```text
用户消息
   ↓
最近对话历史
   ↓
当前文档 / 选中文件 / 选中项目摘要
   ↓
加载 skill: codex-console
   ↓
codex exec + console schema
   ↓
返回结构化聊天响应
   ↓
前端渲染 markdown / changed_files / citations / warnings
```

### 7.6 截图面经导入数据流

```text
用户粘贴截图
   ↓
前端 tesseract.js OCR
   ↓
POST /api/questions/import
   ↓
保存为 sources/question-banks/manual-mianjing/imports/<month>/<file>.md
   ↓
下次索引重建时进入题库解析链
```

### 7.7 文件实时刷新数据流

```text
Codex 修改文件
   ↓
/ws/watch 监听到底层文件变化
   ↓
浏览器收到 changed 事件
   ↓
当前打开文档状态刷新
```

## 8. 索引、检索和匹配链路

### 8.1 主线文档

主线文档会被拆成：

- `documents`
- `sections`
- `sections_fts`

每个 section 是知识锚点，后续 question linking 主要挂在 section 上。

### 8.2 题库

题库会经历：

- `extractQuestions()` 抽问题
- canonical text 归一化
- fingerprint 去重
- 分类和难度推断
- 可选翻译
- 写入 `questions` 和 `questions_fts`

### 8.3 `mywork`

`mywork` 的处理不是“目录全吞”，而是保守扫描：

- 先找候选项目
- 评估它是否值得进入面试索引
- 文档级别建 `documents`
- 项目级别建 `work_projects`
- chunk 级别建 `work_chunks` 和 `work_chunks_fts`

同时，系统会构建项目摘要：

- `openingPitch`
- `whyThisProjectMatters`
- `interviewArc`
- `highlightFacts`
- `deepDiveQuestions`

这些由 `server/lib/projectPrep.ts` 生成，主要服务于：

- mywork tab
- 受管 console 里的“选中项目目录”

### 8.4 Link 关系

当前持久化的核心 link 包括：

- `question_to_section`
- `question_to_document_fallback`
- `question_to_work_chunk`
- `question_to_work`
- `question_to_work_hint`

它们共同决定：

- 题是否出现在某个知识点上
- 是否只能作为章节末尾补充题
- 能否直接引用项目
- 还是只能作为相邻经验

### 8.5 检索模式

建库时系统会记录：

- `retrieval_mode`
- `embedding_model`
- `embedding_error`
- `work_index_summary`

也就是说，OfferLoom 允许：

- 在 embeddings 可用时走 hybrid 模式
- 在 embeddings 不可用时退回 lexical / heuristic 模式

所以它不是一个“必须依赖向量库才可用”的系统。

## 9. 数据结构是什么样的

### 9.1 来源配置结构

核心类型：

- `OfferLoomSource`
- `OfferLoomWorkSource`
- `OfferLoomSourcesConfig`

简化后的配置结构如下：

```json
{
  "guides": [
    {
      "id": "llm-agent-interview-guide",
      "type": "local",
      "path": "./sources/documents/llm-agent-interview-guide",
      "kind": "guide"
    }
  ],
  "questionBanks": [
    {
      "id": "qa-hub",
      "type": "local",
      "path": "./sources/question-banks/qa-hub",
      "kind": "question_bank"
    }
  ],
  "myWork": {
    "id": "candidate-workspace",
    "type": "local",
    "path": "./mywork",
    "kind": "work_root",
    "supplementalRoots": [],
    "manifestPath": "./config/work-manifest.json"
  }
}
```

### 9.2 持久化数据库结构

`scripts/build-db.mjs` 初始化的主表包括：

- `app_meta`
- `sources`
- `documents`
- `sections`
- `questions`
- `links`
- `work_projects`
- `generated_answers`
- `work_chunks`

以及三个 FTS 表：

- `sections_fts`
- `questions_fts`
- `work_chunks_fts`

这套结构的分层含义是：

- `documents`
  原始文档层
- `sections`
  主线知识锚点层
- `questions`
  面试题层
- `links`
  所有 question → guide / work 的关系层
- `work_projects`
  项目汇总层
- `work_chunks`
  项目 chunk 检索层
- `generated_answers`
  LLM 产物持久化层

### 9.3 前端核心数据类型

前端主要围绕这些 TypeScript 类型工作：

- `DocumentData`
- `DocumentSection`
- `QuestionListItem`
- `QuestionDetail`
- `WorkProject`
- `WorkProjectDetail`
- `GeneratedAnswer`
- `AgentJob`

其中有三个类型特别关键：

#### `DocumentData`

表示一篇主线文档的运行时完整形态，包括：

- 文档元信息
- 全量 `sections`
- 每个 section 的 `knowledgeHitCount`
- 每个 section 的 `relatedQuestions`
- 章末 `looseRelatedQuestions`
- `watchPath`

#### `QuestionDetail`

表示一个面试题的完整视图，包括：

- 原文与译文
- `guideMatches`
- `guideFallbackMatches`
- `workMatches`
- `workHintMatches`
- `workEvidenceStatus`
- `generated`

#### `AgentJob`

这是任务中心统一展示的联合类型：

- `answer` job
- `console` job
- `index` job

所以任务中心能用同一套 UI 管理：

- 批量答案生成
- 受管 Codex console
- 索引构建任务

### 9.4 答案包结构

个性化答案包由 `answer-package.schema.json` 约束。

简化后如下：

```json
{
  "question": "...",
  "elevator_pitch": "...",
  "full_answer_markdown": "...",
  "work_story": "...",
  "work_evidence_status": "direct | adjacent | none",
  "work_evidence_note": "...",
  "knowledge_map": [
    {
      "concept": "...",
      "why_it_matters": "...",
      "confidence": "high | medium | low"
    }
  ],
  "citations": [
    {
      "label": "...",
      "path": "...",
      "kind": "guide | question_bank | work | dynamic"
    }
  ],
  "follow_ups": ["..."],
  "missing_basics": ["..."]
}
```

### 9.5 Console Reply 结构

受管 console 的输出由 `codex-console.schema.json` 约束。

简化后如下：

```json
{
  "mode": "answer | edit | review | plan | mixed",
  "headline": "...",
  "summary": "...",
  "reply_markdown": "...",
  "warnings": ["..."],
  "changed_files": [
    {
      "path": "...",
      "summary": "..."
    }
  ],
  "citations": [
    {
      "label": "...",
      "path": "...",
      "kind": "current_document | selected_file | selected_project | guide | work | dynamic"
    }
  ],
  "follow_ups": ["..."]
}
```

它和答案包的差异在于：

- 它更适合对话和文件协作
- 它有 `changed_files`
- 它没有强制要求 `knowledge_map` 和 `work_story`

## 10. 前端如何消费这些数据

前端的工作不是简单地渲染 markdown，而是把结构化数据展开成三个视角：

1. 主线文档视角
2. 面经题目视角
3. 项目工作视角

### 10.1 主线文档视角

文档区以 `DocumentData.sections` 为中心：

- 章节内容直接渲染
- `knowledgeHitCount > 0` 的 section 会高亮
- `relatedQuestions` 放到节底注脚
- `looseRelatedQuestions` 放到章末延伸题

### 10.2 面经题目视角

面经 tab 以 `QuestionDetail` 为中心：

- 显示主线命中与 fallback
- 显示工作证据质量
- 展示已生成答案
- 提供生成 / 重跑 / 跳转到主线位置的入口

### 10.3 我的工作视角

mywork tab 以 `WorkProjectDetail` 为中心：

- 展示项目 opening pitch
- 展示 whyThisProjectMatters
- 展示 interview arc
- 展示 deep dive questions
- 展示相关题目和代表性文档

## 11. 这个系统现在“真正实现了什么”

从代码实现的角度，OfferLoom 当前已经真正实现了下面这些能力：

- 本地 / Git 来源的统一配置与发现
- Guide / Question Bank / `mywork` 的一次性建库
- section / question / work chunk 的分层索引
- exact hit + chapter fallback 的主线挂载
- `direct / adjacent / none` 的工作证据分级
- 中文题目翻译
- 个性化答案包生成与持久化
- 受管 Codex console
- 交互式 PTY Codex 浮窗
- 文档修改后的实时 watch 刷新
- 文本 / 截图面经导入
- 统一任务中心

## 12. 当前实现中有哪些“已写但未完全串满”的部分

为了让报告诚实，这里也明确指出当前还不是“全部 LLM 化”的地方：

1. `question-linker.md`
   还没有被单独接成 LLM linking step，当前 linking 主体仍然是建库脚本里的 scoring / hybrid 逻辑。
2. `work-summarizer.md`
   目前项目摘要主链仍以 `projectPrep.ts` 的规则抽取为主。
3. 检索命中
   仍以高质量启发式 + 可选 embedding 为主，还不是 cross-encoder reranker。
4. Console 与 Answer agent
   当前是两个并列 agent，而不是再往内拆 planner / executor / critic 的多 agent orchestration。

## 13. 为什么这样设计

这套设计背后的原则其实很简单：

- 用 SQLite 把数据结构先立稳，而不是先上重型基础设施
- 用 schema 把 `codex-cli` 变成稳定的数据生产器
- 用 skills 把 prompt 契约固定下来
- 用前后端统一的任务模型把生成、索引、console 三类作业收进同一套治理逻辑
- 用 `mywork` 的保守 triage 防止“硬贴项目”

所以 OfferLoom 最核心的不是某一个花哨 feature，而是下面这条闭环：

```text
主线知识
  → 题目反引
  → 工作证据约束
  → Codex 结构化生成
  → 在线文档站与交互式 agent
```

## 14. 后续最自然的升级方向

如果继续演进，这份架构最自然的下一步包括：

1. 把 `question-linker.md` 接成独立 rerank / linker agent
2. 把 `work-summarizer.md` 接进项目摘要构建链
3. 引入更强的 semantic dedup / clustering
4. 给 `generated_answers` 增加版本号和 prompt lineage
5. 把 console 的改文件行为和文档跳转做得更细

但就当前版本而言，这个系统已经形成了一套闭合的、可发布的、工程边界清晰的实现：

- 有数据底座
- 有 agent 分工
- 有 skill 契约
- 有 `codex-cli` 协作层
- 有持久化结构
- 有前端交互闭环

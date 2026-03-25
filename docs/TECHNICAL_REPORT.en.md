# Technical Report

[中文版本](./TECHNICAL_REPORT.md)

## 1. Product Positioning

OfferLoom is not just a question-bank website, and it is not a general-purpose multi-agent platform.

It is more accurately described as:

- an interview-prep workspace centered on a mainline study guide
- a RAG application that weaves guide knowledge, interview questions, and personal work evidence into one traceable chain
- a documentation site that embeds `codex-cli` as a managed execution layer

It is designed to solve four practical problems:

1. users know many questions, but cannot map them back to concrete knowledge points
2. users can describe projects, but struggle to connect them honestly to foundational interview questions
3. users want both batch-generated answer packages and in-site agent collaboration for follow-up edits and questions
4. public release materials must stay cleanly separated from private `mywork`

## 2. System Boundary

In implementation terms, OfferLoom is currently a:

- web frontend
- Express + WebSocket backend
- SQLite-centered data system
- local `codex-cli` execution environment

One boundary is important:

- OfferLoom does have multiple managed agent roles
- but these agents are product-level job executors
- it is not an internal planner / executor / critic swarm

So the current design is “split responsibilities by product workflow,” not “build a complex autonomous multi-agent society inside every answer.”

## 3. Overall Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Web UI                                                     │
│ Docs / Interviews / My Work / Settings / Jobs / Codex pane │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ HTTP + WebSocket Service                                   │
│ /api/* /ws/codex /ws/watch                                 │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼────────────────┬──────────────────┐
          ▼               ▼                ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Index Agent    │ │ Answer Agent   │ │ Console Agent  │ │ PTY Runtime    │
│ build-db       │ │ answer package │ │ managed Codex  │ │ interactive CLI│
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
└─────────────────────────────────────────────────────────────┘
```

## 4. Which Agents We Built

OfferLoom currently implements four primary agent / runtime roles.

### 4.1 Index Agent

Implementation:

- `server/lib/indexer.ts`
- API entry: `POST /api/index/jobs`

Responsibilities:

- save runtime source configuration
- sync Git-backed or local sources
- invoke `scripts/build-db.mjs`
- build into a temporary database first
- hot-swap the live database only after a successful build
- stream progress and logs back to the UI

This is a build-oriented agent. It does not answer questions directly; it rebuilds the knowledge substrate of the site.

### 4.2 Personalized Answer Agent

Implementation:

- `server/lib/codex.ts`
- class: `AnswerJobManager`
- API entry: `POST /api/generated`

Responsibilities:

- load a question and its linked context
- gather guide anchors
- gather direct and adjacent `mywork` evidence
- merge explicit document references selected by the user
- compose a prompt with skills
- call `codex exec`
- constrain output with JSON schema
- persist results to SQLite and `data/generated/`

This agent is optimized for stable, structured answer packages rather than open-ended chat.

Its output is validated by `schemas/answer-package.schema.json`, including:

- `elevator_pitch`
- `full_answer_markdown`
- `work_story`
- `work_evidence_status`
- `work_evidence_note`
- `knowledge_map`
- `citations`
- `follow_ups`
- `missing_basics`

### 4.3 Managed Codex Console Agent

Implementation:

- `server/lib/codex.ts`
- class: `ManagedCodexConsoleManager`
- API entry: `POST /api/codex-console/jobs`

This is the in-site document copilot.

Responsibilities:

- accept natural-language messages from the floating console
- attach recent conversation history
- attach the current document
- attach selected files
- attach selected project summaries
- call `codex exec`
- return a structured reply under `schemas/codex-console.schema.json`

It is interaction-oriented rather than batch-oriented.

It can:

- explain the current document
- answer with chapter context
- review a selected file
- edit files directly
- produce chat-friendly replies while preserving warnings, citations, and changed file summaries

### 4.4 Interactive PTY Codex Runtime

Implementation:

- `attachCodexPty()` in `server/lib/codex.ts`
- `scripts/codex_pty_bridge.py`
- WebSocket endpoint: `/ws/codex`

This is not a schema-constrained batch agent. It is a true terminal runtime.

Flow:

1. the browser sends `start / input / resize`
2. the server launches a Python PTY bridge
3. the bridge launches the real local `codex` process
4. terminal output is streamed back to the browser
5. the user gets an interactive Codex terminal inside the website

### 4.5 Supporting Non-LLM Workers

There are also two important helper workers:

1. interview import worker
   screenshot OCR is handled in the browser with `tesseract.js`, then saved as a new markdown question-bank source through `POST /api/questions/import`
2. file watch worker
   `/ws/watch` listens for local file changes so documents can refresh immediately after Codex edits them

## 5. Which Skills We Wrote

There are currently 6 skill files under `skills/`.

### 5.1 Skills directly loaded in runtime

#### `answer-composer.md`

Purpose:

- defines the structure and quality bar for personalized answer packages
- forces explicit `direct / adjacent / none`
- keeps the answer interview-ready rather than textbook-like

Used in:

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `mywork-triage.md`

Purpose:

- constrains how the model judges `mywork` relevance
- reinforces the “stop early if not relevant” rule
- preserves honest grounding labels

Used in:

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `project-interviewer.md`

Purpose:

- makes the model think like a strong interviewer when reading project materials
- surfaces project opening, defensible contribution, weak points, and likely follow-ups

Used in:

- `server/lib/codex.ts`
- `scripts/batch-generate.mjs`

#### `codex-console.md`

Purpose:

- defines the managed console’s response style
- keeps replies compact, citation-aware, and UI-friendly
- standardizes warnings and changed-file reporting

Used in:

- `server/lib/codex.ts`

### 5.2 Skills written but not yet auto-loaded into the main runtime path

#### `question-linker.md`

Role:

- intended for question-to-guide anchor selection

Current status:

- present as a prompt asset
- but the main linker logic is still implemented in `scripts/build-db.mjs`
- it is not yet wired in as a separate LLM linker stage

#### `work-summarizer.md`

Role:

- intended for single-project interview summaries

Current status:

- present as a prompt asset
- but project summarization is still primarily handled by `server/lib/projectPrep.ts`

### 5.3 What skills mean in OfferLoom

In OfferLoom, a skill is not a dynamic plugin runtime. It is a prompt contract layer.

Its purpose is to:

- explicitly define role expectations
- stabilize model output shape
- reduce prompt drift across jobs

So the current skill system is best understood as a set of code-loaded prompt contracts.

## 6. How OfferLoom Collaborates with `codex-cli`

This is the core execution design of the project.

There are three collaboration modes.

### 6.1 Schema-Constrained Batch Mode

Used for:

- question translation
- personalized answer generation
- managed console structured replies

Typical shape:

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

Properties:

- prompt is streamed in via stdin
- output is schema-constrained
- the backend consumes only the final structured message
- ideal for persistence and UI rendering

### 6.2 Managed Console Mode

In this mode, OfferLoom does more than send a single user message to Codex.

It injects:

- recent conversation history
- the current document
- explicitly selected files
- selected project summaries
- the `codex-console.md` skill contract

So the division of labor is:

- `codex-cli` performs the actual reasoning and edits
- OfferLoom handles context assembly, task governance, and result structuring

### 6.3 True PTY Terminal Mode

This path does not use `codex exec`. It launches the real CLI itself.

The PTY bridge starts a command shaped like:

```text
codex
  --cd <ROOT_DIR>
  --no-alt-screen
  -a never
  -s danger-full-access
  -m <model>
  -c model_reasoning_effort="<effort>"
```

This preserves the native CLI experience:

- streaming terminal output
- interactive input
- dynamic resize
- true terminal semantics

While the browser adds:

- model and effort switching
- auto-reference to the current document
- searchable file insertion
- live file refresh after edits

### 6.4 Why both Codex paths exist

Because they solve different problems:

1. `codex exec + schema`
   stable, structured, persistable tasks
2. `PTY + interactive codex`
   exploratory workflows, open-ended edits, real terminal collaboration

They are complementary, not redundant.

## 7. How Data Flows

### 7.1 First-run flow

```text
config/sources.json
   ↓
auto-discover sources/documents/* and sources/question-banks/*
   ↓
bootstrap.mjs syncs Git sources when needed
   ↓
build-db.mjs reads guide / question banks / mywork
   ↓
SQLite + FTS + links are built
   ↓
frontend reads from /api/meta /api/documents /api/questions
```

### 7.2 Index-build flow

`scripts/build-db.mjs` performs six main steps:

1. load source config and translation cache
2. parse guide / question bank / `mywork`
3. normalize documents, split sections, extract questions, scan projects, chunk work docs
4. optionally build embeddings
5. link questions to guide / work materials
6. write SQLite, FTS, and `app_meta`

### 7.3 Translation flow

Question translation goes through `scripts/batch-translate-questions.mjs`:

```text
questions
   ↓
batched requests to codex exec
   ↓
question-translation schema output
   ↓
write translatedText into questions.metadata_json
   ↓
update questions_fts
   ↓
save translation cache
```

### 7.4 Personalized answer flow

```text
Question ID
   ↓
db.getQuestion()
   ↓
guideMatches / guideFallbackMatches / workMatches / workHintMatches
   ↓
attach current document + explicit references
   ↓
load skills: answer-composer + mywork-triage + project-interviewer
   ↓
codex exec + answer schema
   ↓
persist to generated_answers
   ↓
persist JSON file to data/generated/<questionId>.json
   ↓
frontend polls job state and renders the package
```

### 7.5 Managed console flow

```text
user message
   ↓
recent conversation
   ↓
current document / selected files / selected projects
   ↓
load skill: codex-console
   ↓
codex exec + console schema
   ↓
return structured chat response
   ↓
frontend renders markdown / changed_files / citations / warnings
```

### 7.6 Screenshot interview import flow

```text
user pastes screenshot
   ↓
frontend OCR via tesseract.js
   ↓
POST /api/questions/import
   ↓
save markdown under sources/question-banks/manual-mianjing/imports/<month>/<file>.md
   ↓
next rebuild ingests it as part of the question bank
```

### 7.7 Live file refresh flow

```text
Codex edits a file
   ↓
/ws/watch observes file system change
   ↓
browser receives changed event
   ↓
current document state refreshes
```

## 8. Indexing, Retrieval, and Matching

### 8.1 Guide layer

Guides are decomposed into:

- `documents`
- `sections`
- `sections_fts`

Each section acts as a knowledge anchor.

### 8.2 Question-bank layer

Question banks go through:

- question extraction
- canonical normalization
- fingerprint deduplication
- type / difficulty classification
- optional translation
- insertion into `questions` and `questions_fts`

### 8.3 `mywork` layer

`mywork` is processed conservatively:

- candidate projects are detected first
- project relevance is scored before deep indexing
- documents enter `documents`
- projects enter `work_projects`
- chunks enter `work_chunks` and `work_chunks_fts`

The system also builds project-prep structures:

- `openingPitch`
- `whyThisProjectMatters`
- `interviewArc`
- `highlightFacts`
- `deepDiveQuestions`

These are mainly generated by `server/lib/projectPrep.ts`.

### 8.4 Link relations

The main persisted relations are:

- `question_to_section`
- `question_to_document_fallback`
- `question_to_work_chunk`
- `question_to_work`
- `question_to_work_hint`

These determine:

- whether a question is attached to a concrete knowledge point
- whether it only belongs to a chapter-level fallback bucket
- whether project evidence is direct, adjacent, or absent

### 8.5 Retrieval modes

The build pipeline records:

- `retrieval_mode`
- `embedding_model`
- `embedding_error`
- `work_index_summary`

So OfferLoom can:

- use hybrid retrieval when embeddings are available
- gracefully fall back to lexical / heuristic retrieval when they are not

## 9. What the Data Structures Look Like

### 9.1 Source configuration

Core config types:

- `OfferLoomSource`
- `OfferLoomWorkSource`
- `OfferLoomSourcesConfig`

Simplified example:

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

### 9.2 Persistent database schema

Main tables:

- `app_meta`
- `sources`
- `documents`
- `sections`
- `questions`
- `links`
- `work_projects`
- `generated_answers`
- `work_chunks`

FTS tables:

- `sections_fts`
- `questions_fts`
- `work_chunks_fts`

Semantic roles:

- `documents`: raw source documents
- `sections`: guide knowledge anchors
- `questions`: interview questions
- `links`: all question-to-guide / question-to-work relations
- `work_projects`: project-level summaries
- `work_chunks`: chunk-level work retrieval units
- `generated_answers`: persisted LLM outputs

### 9.3 Frontend runtime types

The UI mainly revolves around:

- `DocumentData`
- `DocumentSection`
- `QuestionListItem`
- `QuestionDetail`
- `WorkProject`
- `WorkProjectDetail`
- `GeneratedAnswer`
- `AgentJob`

Three especially important structures are:

#### `DocumentData`

Contains:

- document metadata
- all `sections`
- per-section `knowledgeHitCount`
- per-section `relatedQuestions`
- chapter-end `looseRelatedQuestions`
- `watchPath`

#### `QuestionDetail`

Contains:

- original and translated question text
- `guideMatches`
- `guideFallbackMatches`
- `workMatches`
- `workHintMatches`
- `workEvidenceStatus`
- `generated`

#### `AgentJob`

A unified job type for:

- answer jobs
- console jobs
- index jobs

This is why the task center can manage all three workflows inside one UI.

### 9.4 Answer-package schema

`answer-package.schema.json` defines the personalized answer package.

Simplified shape:

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

### 9.5 Console-reply schema

`codex-console.schema.json` defines the managed console output.

Simplified shape:

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

Compared with the answer package:

- it is optimized for chat and file collaboration
- it includes `changed_files`
- it does not force `knowledge_map` or `work_story`

## 10. How the Frontend Consumes the Data

The frontend does not just render markdown. It projects the structured data into three views:

1. mainline guide view
2. interview-question view
3. work-project view

### 10.1 Mainline guide view

Centered on `DocumentData.sections`:

- section content is rendered directly
- sections with `knowledgeHitCount > 0` are highlighted
- `relatedQuestions` become section footnotes
- `looseRelatedQuestions` become chapter-end extension questions

### 10.2 Interview view

Centered on `QuestionDetail`:

- shows mainline exact hits and fallback hits
- shows work-evidence quality
- renders generated answer packages
- supports generation, rerun, and jump-back links into the guide

### 10.3 MyWork view

Centered on `WorkProjectDetail`:

- opening pitch
- why the project matters
- interview arc
- deep-dive questions
- related interview questions and representative files

## 11. What Is Actually Implemented Today

From an implementation perspective, OfferLoom already supports:

- unified local / Git source configuration and discovery
- one-time indexing of guides, question banks, and `mywork`
- layered indexing over sections, questions, and work chunks
- exact-hit + chapter-fallback guide linking
- `direct / adjacent / none` work-evidence grading
- Chinese question translation
- structured personalized answer generation and persistence
- managed Codex console
- interactive PTY Codex terminal
- live file refresh after edits
- text / screenshot interview import
- a unified task center

## 12. What Is Written but Not Fully Wired Yet

To keep the report honest:

1. `question-linker.md`
   exists, but the linker is still primarily implemented as scoring / hybrid logic inside `build-db.mjs`
2. `work-summarizer.md`
   exists, but project summarization is still mainly handled by `projectPrep.ts`
3. exact-hit retrieval
   still relies on strong heuristics plus optional embeddings, not a full cross-encoder reranker
4. answer agent vs. console agent
   are parallel product agents, not a deeper internal planner / executor multi-agent orchestration

## 13. Why the System Is Designed This Way

The design principles are simple:

- keep the data model stable first with SQLite
- use schema constraints to turn `codex-cli` into a reliable structured-output producer
- use skills to stabilize prompt contracts
- use a unified job model to govern indexing, generation, and console tasks together
- use conservative `mywork` triage to prevent fake project grounding

So the core closed loop of OfferLoom is:

```text
mainline knowledge
  → interview backlinks
  → work-evidence constraints
  → Codex structured generation
  → online documentation + interactive agent collaboration
```

## 14. Natural Next Steps

The architecture is well positioned for further upgrades:

1. wire `question-linker.md` into a dedicated linker / reranker step
2. wire `work-summarizer.md` into project-summary generation
3. add stronger semantic dedup / clustering
4. add prompt lineage and versioning to `generated_answers`
5. make console-driven edits and doc jumps even tighter

Even in its current form, though, the system is already a complete, publishable implementation with:

- a stable data substrate
- explicit agent roles
- a real skill layer
- a practical `codex-cli` collaboration model
- persistent answer structures
- a full frontend interaction loop

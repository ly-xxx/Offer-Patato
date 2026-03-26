import type {
  AgentJob,
  CodexConsoleJob,
  DocumentData,
  DocumentListItem,
  InterviewerJob,
  InterviewImportPayload,
  InterviewImportResult,
  IndexJobStatus,
  JobStatus,
  MetaResponse,
  SourcesConfig,
  SourcesSettingsSnapshot,
  QuestionDetail,
  QuestionListItem,
  SearchResponse,
  WorkProject,
  WorkProjectDetail
} from './types'

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<T>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : {}
}

function readArray<T>(value: unknown) {
  return Array.isArray(value) ? value as T[] : []
}

function readWorkEvidenceStatus(value: unknown): 'adjacent' | 'direct' | 'none' | undefined {
  return value === 'adjacent' || value === 'direct' || value === 'none' ? value : undefined
}

function normalizeCitations(value: unknown) {
  return readArray<Record<string, unknown>>(value)
    .map((item, index) => ({
      kind: readString(item.kind, 'dynamic'),
      label: readString(item.label, `引用 ${index + 1}`),
      path: readString(item.path)
    }))
    .filter((item) => item.label || item.path)
}

function normalizeKnowledgeMap(value: unknown) {
  return readArray<Record<string, unknown>>(value)
    .map((item) => ({
      concept: readString(item.concept),
      confidence: readString(item.confidence, 'medium'),
      why_it_matters: readString(item.why_it_matters)
    }))
    .filter((item) => item.concept || item.why_it_matters)
}

function normalizeGeneratedOutput(value: unknown) {
  const raw = readRecord(value)
  return {
    citations: normalizeCitations(raw.citations),
    elevator_pitch: readNullableString(raw.elevator_pitch) ?? undefined,
    follow_ups: readArray<string>(raw.follow_ups).filter((item) => typeof item === 'string' && item.trim()),
    full_answer_markdown: readNullableString(raw.full_answer_markdown) ?? undefined,
    knowledge_map: normalizeKnowledgeMap(raw.knowledge_map),
    missing_basics: readArray<string>(raw.missing_basics).filter((item) => typeof item === 'string' && item.trim()),
    question: readNullableString(raw.question) ?? undefined,
    work_evidence_note: readNullableString(raw.work_evidence_note) ?? undefined,
    work_evidence_status: readWorkEvidenceStatus(raw.work_evidence_status),
    work_story: readNullableString(raw.work_story) ?? undefined
  }
}

function normalizeGeneratedAnswer(value: unknown): QuestionDetail['generated'] {
  if (!isRecord(value)) {
    return null
  }

  const output = normalizeGeneratedOutput(value.output)
  return {
    citations: normalizeCitations(value.citations),
    id: readString(value.id),
    model: readString(value.model),
    output,
    outputMarkdown: readString(value.outputMarkdown, output.full_answer_markdown ?? ''),
    questionId: readString(value.questionId),
    reasoningEffort: readString(value.reasoningEffort),
    status: readString(value.status),
    updatedAt: readString(value.updatedAt)
  }
}

function normalizeGenerationHistory(value: unknown): QuestionDetail['generationHistory'] {
  return readArray<Record<string, unknown>>(value)
    .map((item, index) => ({
      id: readString(item.id, `history-${index + 1}`),
      model: readString(item.model, 'gpt-5.4'),
      reasoningEffort: readString(item.reasoningEffort, 'high'),
      status: readString(item.status, 'ready'),
      updatedAt: readString(item.updatedAt)
    }))
    .filter((item) => item.updatedAt || item.id)
}

function normalizeGuideMatch(value: unknown, index: number): QuestionDetail['guideMatches'][number] {
  const raw = readRecord(value)
  return {
    anchor: readString(raw.anchor),
    content: readString(raw.content),
    documentId: readString(raw.documentId),
    documentTitle: readString(raw.documentTitle, '未命名文档'),
    endLine: readNumber(raw.endLine),
    heading: readString(raw.heading, '未命名章节'),
    id: readString(raw.id, `guide-match-${index + 1}`),
    level: readNumber(raw.level, 1),
    path: readString(raw.path),
    relPath: readString(raw.relPath),
    score: readNumber(raw.score),
    startLine: readNumber(raw.startLine)
  }
}

function normalizeGuideFallbackMatch(value: unknown): QuestionDetail['guideFallbackMatches'][number] {
  const raw = readRecord(value)
  return {
    documentId: readString(raw.documentId),
    documentTitle: readString(raw.documentTitle, '未命名文档'),
    path: readString(raw.path),
    relPath: readString(raw.relPath),
    score: readNumber(raw.score, 0)
  }
}

function normalizeWorkMatch(value: unknown, index: number): QuestionDetail['workMatches'][number] {
  const raw = readRecord(value)
  return {
    id: readString(raw.id, `work-match-${index + 1}`),
    meta: readRecord(raw.meta),
    path: readString(raw.path),
    relPath: readString(raw.relPath),
    score: readNumber(raw.score),
    title: readString(raw.title, '未命名材料')
  }
}

function normalizeRelatedQuestion(value: unknown): DocumentData['sections'][number]['relatedQuestions'][number] {
  const raw = readRecord(value)
  const generated = isRecord(raw.generated) ? normalizeGeneratedOutput(raw.generated) : null
  const generatedCount = readNumber(raw.generatedCount, generated ? 1 : 0)
  const generatedStatus = readNullableString(raw.generatedStatus) ?? (generatedCount > 0 ? 'ready' : null)

  return {
    difficulty: readString(raw.difficulty, 'medium'),
    displayText: readString(raw.displayText, readString(raw.text)),
    generated,
    generatedCount,
    generatedStatus,
    id: readString(raw.id),
    isRevisited: Boolean(raw.isRevisited),
    lastGeneratedAt: readNullableString(raw.lastGeneratedAt),
    questionType: readString(raw.questionType, 'general'),
    score: readNumber(raw.score),
    text: readString(raw.text, readString(raw.displayText)),
    translatedText: readNullableString(raw.translatedText)
  }
}

function normalizeDocumentSection(value: unknown, index: number): DocumentData['sections'][number] {
  const raw = readRecord(value)
  return {
    anchor: readString(raw.anchor, `section-${index + 1}`),
    content: readString(raw.content),
    endLine: readNumber(raw.endLine),
    heading: readString(raw.heading, '未命名章节'),
    knowledgeHitCount: readNumber(raw.knowledgeHitCount),
    level: readNumber(raw.level, 1),
    relatedQuestions: readArray(raw.relatedQuestions).map((item) => normalizeRelatedQuestion(item)),
    startLine: readNumber(raw.startLine)
  }
}

function normalizeDocumentListItem(value: unknown): DocumentListItem {
  const raw = readRecord(value)
  return {
    ext: readString(raw.ext, 'md'),
    id: readString(raw.id),
    kind: readString(raw.kind, 'guide'),
    knowledgeHitCount: typeof raw.knowledgeHitCount === 'number' ? raw.knowledgeHitCount : undefined,
    path: readString(raw.path),
    relPath: readString(raw.relPath),
    sourceId: readString(raw.sourceId),
    title: readString(raw.title, readString(raw.relPath, 'Untitled')),
    updatedAt: readString(raw.updatedAt)
  }
}

function normalizeQuestionListItem(value: unknown): QuestionListItem {
  const raw = readRecord(value)
  const generatedCount = readNumber(raw.generatedCount)
  return {
    categoryId: readString(raw.categoryId, 'uncategorized'),
    categoryLabel: readString(raw.categoryLabel, '未分类'),
    categoryOrder: readNumber(raw.categoryOrder, 999),
    company: readNullableString(raw.company),
    displayText: readString(raw.displayText, readString(raw.text)),
    difficulty: readString(raw.difficulty, 'medium'),
    generatedCount,
    guideFallbackCount: readNumber(raw.guideFallbackCount),
    generatedStatus: readNullableString(raw.generatedStatus) ?? (generatedCount > 0 ? 'ready' : null),
    guideLinkCount: readNumber(raw.guideLinkCount),
    id: readString(raw.id),
    interviewDate: readNullableString(raw.interviewDate),
    interviewFacet: readString(raw.interviewFacet, 'general'),
    importOrigin: readNullableString(raw.importOrigin),
    lastGeneratedAt: readNullableString(raw.lastGeneratedAt),
    questionType: readString(raw.questionType, 'general'),
    role: readNullableString(raw.role),
    sourceId: readString(raw.sourceId),
    sourcePath: readString(raw.sourcePath),
    sourceSequence: readNumber(raw.sourceSequence, Number.MAX_SAFE_INTEGER),
    sourceTitle: readString(raw.sourceTitle, '未命名来源'),
    text: readString(raw.text, readString(raw.displayText)),
    translatedText: readNullableString(raw.translatedText),
    workLinkCount: readNumber(raw.workLinkCount)
  }
}

function normalizeQuestionDetail(value: unknown): QuestionDetail {
  const raw = readRecord(value)
  const generated = normalizeGeneratedAnswer(raw.generated)
  const generationHistory = normalizeGenerationHistory(raw.generationHistory)
  const generatedCount = readNumber(raw.generatedCount, generationHistory.length > 0 ? generationHistory.length : generated ? 1 : 0)

  return {
    displayText: readString(raw.displayText, readString(raw.text)),
    difficulty: readString(raw.difficulty, 'medium'),
    generated,
    generatedCount,
    generationHistory,
    guideFallbackMatches: readArray(raw.guideFallbackMatches).map((item) => normalizeGuideFallbackMatch(item)),
    guideMatches: readArray(raw.guideMatches).map((item, index) => normalizeGuideMatch(item, index)),
    id: readString(raw.id),
    lastGeneratedAt: readNullableString(raw.lastGeneratedAt) ?? generationHistory[0]?.updatedAt ?? generated?.updatedAt ?? null,
    metadata: readRecord(raw.metadata),
    questionType: readString(raw.questionType, 'general'),
    sourceId: readString(raw.sourceId),
    sourcePath: readString(raw.sourcePath),
    sourceTitle: readString(raw.sourceTitle, '未命名来源'),
    text: readString(raw.text, readString(raw.displayText)),
    translatedText: readNullableString(raw.translatedText),
    workEvidenceStatus: readWorkEvidenceStatus(raw.workEvidenceStatus)
      ?? generated?.output.work_evidence_status
      ?? 'none',
    workHintMatches: readArray(raw.workHintMatches).map((item, index) => normalizeWorkMatch(item, index)),
    workMatches: readArray(raw.workMatches).map((item, index) => normalizeWorkMatch(item, index))
  }
}

function normalizeDocumentData(value: unknown): DocumentData {
  const raw = readRecord(value)
  return {
    content: readString(raw.content),
    ext: readString(raw.ext, 'md'),
    id: readString(raw.id),
    kind: readString(raw.kind, 'guide'),
    looseRelatedQuestions: readArray(raw.looseRelatedQuestions).map((item) => normalizeRelatedQuestion(item)),
    meta: readRecord(raw.meta),
    path: readString(raw.path),
    relPath: readString(raw.relPath),
    sections: readArray(raw.sections).map((item, index) => normalizeDocumentSection(item, index)),
    sourceId: readString(raw.sourceId),
    title: readString(raw.title, readString(raw.relPath, 'Untitled')),
    updatedAt: readString(raw.updatedAt),
    watchPath: readNullableString(raw.watchPath)
  }
}

export function fetchMeta() {
  return request<MetaResponse>('/api/meta')
}

export function fetchSourcesSettings() {
  return request<SourcesSettingsSnapshot>('/api/settings/sources')
}

export function saveSourcesSettings(config: SourcesConfig) {
  return request<{ config: SourcesConfig; ok: true }>('/api/settings/sources', {
    method: 'POST',
    body: JSON.stringify({ config })
  })
}

export function fetchQuestions(options: { category?: string; limit?: number; search?: string } = {}) {
  const params = new URLSearchParams()
  if (options.search) {
    params.set('search', options.search)
  }
  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit))
  }
  if (options.category) {
    params.set('category', options.category)
  }
  return request<unknown[]>(`/api/questions?${params.toString()}`)
    .then((items) => items.map((item) => normalizeQuestionListItem(item)))
}

export function fetchQuestionDetail(questionId: string) {
  return request<unknown>(`/api/questions/${questionId}`)
    .then((item) => normalizeQuestionDetail(item))
}

export function importInterviewEntry(payload: InterviewImportPayload) {
  return request<InterviewImportResult>('/api/questions/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function fetchDocuments() {
  return request<unknown[]>('/api/documents?limit=600')
    .then((items) => items.map((item) => normalizeDocumentListItem(item)))
}

export function fetchDocument(documentId: string) {
  return request<unknown>(`/api/documents/${documentId}`)
    .then((item) => normalizeDocumentData(item))
}

export function fetchSearch(query: string) {
  return request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`)
}

export function fetchWorkProjects() {
  return request<WorkProject[]>('/api/work-projects')
}

export function fetchWorkProjectDetail(projectId: string) {
  return request<WorkProjectDetail>(`/api/work-projects/${projectId}`)
}

export function startAnswerGeneration(body: {
  autoReferenceCurrentDoc: boolean
  currentDocumentId?: string | null
  model: string
  questionId: string
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh'
  selectedDocumentIds: string[]
}) {
  return request<JobStatus>('/api/generated', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function fetchJob(jobId: string) {
  return request<JobStatus>(`/api/jobs/${jobId}`)
}

export function startCodexConsoleJob(body: {
  autoReferenceCurrentDoc: boolean
  conversation: Array<{ content: string; role: 'assistant' | 'user' }>
  currentDocumentId?: string | null
  message: string
  model: string
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh'
  selectedDocumentIds: string[]
  selectedProjectIds: string[]
}) {
  return request<CodexConsoleJob>('/api/codex-console/jobs', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function fetchCodexConsoleJob(jobId: string) {
  return request<CodexConsoleJob>(`/api/codex-console/jobs/${jobId}`)
}

export function cancelCodexConsoleJob(jobId: string) {
  return request<CodexConsoleJob>(`/api/codex-console/jobs/${jobId}/cancel`, {
    method: 'POST'
  })
}

export function startInterviewerJob(body: {
  candidateAnswer?: string
  conversation: Array<{ content: string; role: 'assistant' | 'user' }>
  questionId: string
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh'
  seedFollowUp: string
}) {
  return request<InterviewerJob>('/api/interviewer/jobs', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function fetchInterviewerJob(jobId: string) {
  return request<InterviewerJob>(`/api/interviewer/jobs/${jobId}`)
}

export function cancelInterviewerJob(jobId: string) {
  return request<InterviewerJob>(`/api/interviewer/jobs/${jobId}/cancel`, {
    method: 'POST'
  })
}

export function startIndexJob(config: SourcesConfig) {
  return request<IndexJobStatus>('/api/index/jobs', {
    method: 'POST',
    body: JSON.stringify({ config })
  })
}

export function fetchIndexJob(jobId: string) {
  return request<IndexJobStatus>(`/api/index/jobs/${jobId}`)
}

export function cancelIndexJob(jobId: string) {
  return request<IndexJobStatus>(`/api/index/jobs/${jobId}/cancel`, {
    method: 'POST'
  })
}

export function fetchAgentJobs() {
  return request<AgentJob[]>('/api/agents/jobs')
}

export function fetchAgentJob(jobId: string) {
  return request<AgentJob>(`/api/agents/jobs/${jobId}`)
}

export function cancelAgentJob(jobId: string) {
  return request<AgentJob>(`/api/agents/jobs/${jobId}/cancel`, {
    method: 'POST'
  })
}

export function rerunAgentJob(jobId: string, promptOverride?: string) {
  return request<AgentJob>(`/api/agents/jobs/${jobId}/rerun`, {
    method: 'POST',
    body: JSON.stringify({ promptOverride })
  })
}

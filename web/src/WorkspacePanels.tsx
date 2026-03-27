import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import {
  Bot,
  FolderInput,
  GitBranch,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Square,
  Wand2,
  X
} from 'lucide-react'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { normalizeMarkdownForRender } from './markdown'
import type {
  AgentJob,
  InterviewerReply,
  IndexJobStatus,
  SourcesConfig,
  SourcesSettingsSnapshot,
  UiTypographySettings
} from './types'

type DrawerProps = {
  className?: string
  children: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  icon?: ReactNode
  onClose: () => void
  open: boolean
  title: string
}

export function SettingsDrawer(props: {
  busy: boolean
  draftConfig: SourcesConfig | null
  indexJob: IndexJobStatus | null
  onClose: () => void
  onDraftChange: (next: SourcesConfig) => void
  onResetDefaults: () => void
  onSave: () => void
  onStartBuild: () => void
  onThemeChange: (themeId: string) => void
  onTypographyChange: (next: UiTypographySettings) => void
  open: boolean
  settings: SourcesSettingsSnapshot | null
  themeId: string
  themes: Array<{
    group: string
    hint: string
    id: string
    label: string
    swatches: [string, string, string]
  }>
  typography: UiTypographySettings
}) {
  const draft = props.draftConfig
  const themeGroups = props.themes.reduce<Record<string, typeof props.themes>>((accumulator, theme) => {
    if (!accumulator[theme.group]) {
      accumulator[theme.group] = []
    }
    accumulator[theme.group].push(theme)
    return accumulator
  }, {})

  return (
    <OverlayDrawer
      description="文字 / 主题 / 数据"
      icon={<Settings2 size={18} />}
      onClose={props.onClose}
      open={props.open}
      title="设置"
    >
      {!draft || !props.settings ? (
        <div className="control-empty">正在载入来源配置…</div>
      ) : (
        <div className="control-panel-body">
          <section className="control-card">
            <div className="control-card-head compact">
              <div className="section-headline">
                <span className="section-head-icon" aria-hidden="true">Aa</span>
                <strong>文字</strong>
              </div>
            </div>

            <TypographySlider
              icon="Aa"
              label="正文"
              max={22}
              min={15.5}
              onChange={(value) => props.onTypographyChange({ ...props.typography, docFontSize: value })}
              step={0.5}
              value={props.typography.docFontSize}
            />
            <TypographySlider
              icon="H"
              label="标题倍率"
              max={1.24}
              min={0.9}
              onChange={(value) => props.onTypographyChange({ ...props.typography, docHeadingScale: value })}
              step={0.01}
              value={props.typography.docHeadingScale}
            />
            <TypographySlider
              icon="≣"
              label="侧边栏"
              max={16}
              min={11.5}
              onChange={(value) => props.onTypographyChange({ ...props.typography, sidebarFontSize: value })}
              step={0.5}
              value={props.typography.sidebarFontSize}
            />
            <TypographySlider
              icon="✦"
              label="答案卡片"
              max={18}
              min={12.5}
              onChange={(value) => props.onTypographyChange({ ...props.typography, answerFontSize: value })}
              step={0.5}
              value={props.typography.answerFontSize}
            />
          </section>

          <section className="control-card">
            <div className="control-card-head compact">
              <div className="section-headline">
                <span className="section-head-icon" aria-hidden="true">
                  <Palette size={15} />
                </span>
                <strong>主题</strong>
              </div>
            </div>

            <div className="theme-groups">
              {Object.entries(themeGroups).map(([groupLabel, themes]) => (
                <section key={groupLabel} className="theme-group">
                  <div className="theme-group-title">{groupLabel}</div>
                  <div className="theme-picker-grid">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        className={`theme-picker-card ${props.themeId === theme.id ? 'active' : ''}`}
                        onClick={() => props.onThemeChange(theme.id)}
                      >
                        <div
                          className="theme-preview-strip"
                          style={{
                            background: `linear-gradient(135deg, ${theme.swatches[0]}, ${theme.swatches[1]} 52%, ${theme.swatches[2]})`
                          }}
                        />
                        <div className="theme-picker-head">
                          <div className="theme-picker-label">
                            <Palette size={14} />
                            <strong>{theme.label}</strong>
                          </div>
                          <span>{theme.hint}</span>
                        </div>
                        <div className="theme-swatch-row">
                          {theme.swatches.map((color) => (
                            <span key={`${theme.id}-${color}`} className="theme-swatch-dot" style={{ background: color }} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="control-card">
            <div className="control-card-head compact">
              <div className="section-headline">
                <span className="section-head-icon" aria-hidden="true">
                  <FolderInput size={15} />
                </span>
                <strong>来源</strong>
              </div>
              <div className="head-icon-actions">
                <button
                  aria-label="恢复默认来源配置"
                  className="ghost-button icon-button"
                  onClick={props.onResetDefaults}
                  title="恢复默认"
                  type="button"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            <div className="settings-meta-grid compact">
              <div className="settings-meta-chip">
                <span>主线</span>
                <strong>{props.settings.discoveredSources.guides.length}</strong>
              </div>
              <div className="settings-meta-chip">
                <span>题库</span>
                <strong>{props.settings.discoveredSources.questionBanks.length}</strong>
              </div>
              <div className="settings-meta-chip wide">
                <span>mywork</span>
                <strong>{draft.myWork.path ?? draft.myWork.url ?? draft.myWork.id}</strong>
              </div>
            </div>

            <SourceGroupEditor
              items={draft.guides}
              label="主线"
              onChange={(items) => props.onDraftChange({ ...draft, guides: items })}
              templateKind="guide"
            />

            <SourceGroupEditor
              items={draft.questionBanks}
              label="题库"
              onChange={(items) => props.onDraftChange({ ...draft, questionBanks: items })}
              templateKind="question_bank"
            />

            <WorkSourceEditor
              autoDetectedMyWorkPath={props.settings.autoDetectedMyWorkPath}
              value={draft.myWork}
              onChange={(myWork) => props.onDraftChange({ ...draft, myWork })}
            />

            <div className="settings-actions compact">
              <button className="ghost-button" disabled={props.busy} onClick={props.onSave}>
                <Save size={16} />
                保存
              </button>
              <button className="primary-button" disabled={props.busy} onClick={props.onStartBuild}>
                <Wand2 size={16} />
                重建
              </button>
            </div>
          </section>

          {props.indexJob && (
            <section className="control-card mixer-card">
              <div className="control-card-head compact">
                <div className="section-headline">
                  <span className="section-head-icon" aria-hidden="true">
                    <Wand2 size={15} />
                  </span>
                  <strong>索引</strong>
                </div>
                <span className={`pill ${props.indexJob.status === 'ready' ? 'success' : ''}`}>
                  {describeJobStatus(props.indexJob.status)}
                </span>
              </div>

              <div className="index-progress-shell">
                <div className="index-progress-bar">
                  <div style={{ width: `${Math.round(props.indexJob.progress * 100)}%` }} />
                </div>
                <strong>{Math.round(props.indexJob.progress * 100)}%</strong>
              </div>

              {props.indexJob.configSummary && (
                <div className="settings-meta-grid">
                  <div className="settings-meta-chip">
                    <span>主线</span>
                    <strong>{props.indexJob.configSummary.guideCount}</strong>
                  </div>
                  <div className="settings-meta-chip">
                    <span>题库</span>
                    <strong>{props.indexJob.configSummary.questionBankCount}</strong>
                  </div>
                  <div className="settings-meta-chip wide">
                    <span>mywork</span>
                    <strong>{props.indexJob.configSummary.myWorkSource}</strong>
                  </div>
                </div>
              )}

              <div className="job-log-list">
                {props.indexJob.logs.slice(-10).map((line, index) => (
                  <div key={`${props.indexJob!.id}-${index}`} className="job-log-line">{line}</div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </OverlayDrawer>
  )
}

export function JobsDrawer(props: {
  jobs: AgentJob[]
  onCancel: (jobId: string) => void
  onClose: () => void
  onPromptDraftChange: (value: string) => void
  onRerun: (jobId: string, prompt: string) => void
  onSelectJob: (jobId: string) => void
  open: boolean
  promptDraft: string
  selectedJob: AgentJob | null
}) {
  const { historyEntries, interviewerGroup, runningEntries } = buildJobEntries(props.jobs, props.selectedJob)
  const effectiveSelectedJob: AgentJob | null = interviewerGroup?.latestJob ?? props.selectedJob
  const effectivePromptDraft = interviewerGroup && interviewerGroup.latestJob.id !== props.selectedJob?.id
    ? interviewerGroup.latestJob.promptPreview ?? ''
    : props.promptDraft

  return (
    <OverlayDrawer
      description={`${runningEntries.length} 运行 · ${historyEntries.length} 完成`}
      icon={<Bot size={18} />}
      onClose={props.onClose}
      open={props.open}
      title="任务"
    >
      <div className="control-panel-body two-column">
        <section className="control-card">
          <div className="control-card-head compact">
            <div className="section-headline">
              <span className="section-head-icon" aria-hidden="true">
                <Bot size={15} />
              </span>
              <strong>运行中</strong>
            </div>
          </div>

          <div className="agent-job-section">
            <span className="agent-group-title">正在运行</span>
            <div className="agent-job-list">
              {(runningEntries.length > 0 ? runningEntries : historyEntries.slice(0, 8)).map((entry) => renderJobEntryCard(entry, interviewerGroup, props.selectedJob, props.onSelectJob))}
            </div>
          </div>

          {historyEntries.length > 0 && (
            <div className="agent-job-section">
              <span className="agent-group-title">最近完成</span>
              <div className="agent-job-list compact">
                {historyEntries.slice(0, 10).map((entry) => renderJobEntryCard(entry, interviewerGroup, props.selectedJob, props.onSelectJob, true))}
              </div>
            </div>
          )}
        </section>

        <section className="control-card">
          {interviewerGroup && effectiveSelectedJob?.kind === 'interviewer' ? (
            <>
              <div className="control-card-head compact">
                <div className="section-headline">
                  <span className="section-head-icon" aria-hidden="true">
                    <Bot size={15} />
                  </span>
                  <strong>{interviewerGroup.title}</strong>
                </div>
                <div className="job-action-row">
                  {(effectiveSelectedJob.status === 'queued' || effectiveSelectedJob.status === 'running') && (
                    <button className="ghost-button danger-button" onClick={() => props.onCancel(effectiveSelectedJob.id)}>
                      <Square size={15} />
                      停止
                    </button>
                  )}
                  <button
                    className="ghost-button"
                    onClick={() => props.onRerun(effectiveSelectedJob.id, effectivePromptDraft)}
                  >
                    <RefreshCw size={15} />
                    重跑
                  </button>
                </div>
              </div>

              <div className="settings-meta-grid">
                <div className="settings-meta-chip">
                  <span>类型</span>
                  <strong>面试官会话</strong>
                </div>
                <div className="settings-meta-chip">
                  <span>轮次</span>
                  <strong>{interviewerGroup.jobs.length}</strong>
                </div>
                <div className="settings-meta-chip">
                  <span>最新状态</span>
                  <strong>{describeJobStatus(effectiveSelectedJob.status)}</strong>
                </div>
                <div className="settings-meta-chip">
                  <span>模型</span>
                  <strong>{effectiveSelectedJob.model}</strong>
                </div>
                <div className="settings-meta-chip">
                  <span>effort</span>
                  <strong>{effectiveSelectedJob.reasoningEffort}</strong>
                </div>
                <div className="settings-meta-chip">
                  <span>阶段</span>
                  <strong>{effectiveSelectedJob.stage ?? 'queued'}</strong>
                </div>
              </div>

              <div className="interviewer-history-timeline">
                {interviewerGroup.jobs
                  .slice()
                  .sort((left, right) => left.startedAt.localeCompare(right.startedAt, 'en'))
                  .map((job, index) => (
                    <section key={job.id} className="interviewer-history-round">
                      <div className="interviewer-history-round-head">
                        <div>
                          <strong>{`第 ${index + 1} 轮`}</strong>
                          <p>{formatJobStartedAt(job.startedAt)}</p>
                        </div>
                        <div className="interviewer-history-round-meta">
                          <span className={`pill subtle ${job.status === 'ready' ? 'success' : ''}`}>{describeJobStatus(job.status)}</span>
                        </div>
                      </div>

                      {job.candidateAnswer?.trim() && (
                        <article className="console-message user interviewer-history-message">
                          <div className="console-message-bubble">
                            <p>{job.candidateAnswer.trim()}</p>
                          </div>
                        </article>
                      )}

                      <article className="console-message assistant interviewer-history-message">
                        {job.status === 'ready' && job.result ? (
                          <InterviewerHistoryReplyCard reply={job.result} />
                        ) : (
                          <div className={`console-assistant-card ${job.status === 'running' ? 'running' : job.status}`}>
                            <span className="console-inline-status">{job.summary ?? '面试官正在处理这一轮'}</span>
                            {job.liveText && (
                              <div className="console-markdown live-preview">
                                {normalizeMarkdownForRender(job.liveText)}
                              </div>
                            )}
                            {job.error && <p className="console-summary">{job.error}</p>}
                            {job.liveLogs && job.liveLogs.length > 0 && (
                              <div className="job-log-list stream-log-list">
                                {job.liveLogs.slice(-6).map((line: string) => (
                                  <div key={`${job.id}-${line}`} className="job-log-line">{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    </section>
                  ))}
              </div>

              {effectiveSelectedJob.promptPreview ? (
                <div className="prompt-editor-card">
                  <span>Prompt</span>
                  <textarea
                    value={effectivePromptDraft}
                    onChange={(event) => props.onPromptDraftChange(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          ) : effectiveSelectedJob ? (
            <>
              <div className="control-card-head compact">
                <div className="section-headline">
                  <span className="section-head-icon" aria-hidden="true">
                    <Bot size={15} />
                  </span>
                  <strong>{readJobTitle(effectiveSelectedJob)}</strong>
                </div>
                <div className="job-action-row">
                  {(effectiveSelectedJob.status === 'queued' || effectiveSelectedJob.status === 'running') && (
                    <button className="ghost-button danger-button" onClick={() => props.onCancel(effectiveSelectedJob.id)}>
                      <Square size={15} />
                      停止
                    </button>
                  )}
                  {effectiveSelectedJob.kind !== 'index' && (
                    <button
                      className="ghost-button"
                      onClick={() => props.onRerun(effectiveSelectedJob.id, props.promptDraft)}
                    >
                      <RefreshCw size={15} />
                      重跑
                    </button>
                  )}
                </div>
              </div>

              <div className="settings-meta-grid">
                <div className="settings-meta-chip">
                  <span>类型</span>
                  <strong>{describeJobKind(effectiveSelectedJob.kind)}</strong>
                </div>
                {'model' in effectiveSelectedJob && (
                  <div className="settings-meta-chip">
                    <span>模型</span>
                    <strong>{effectiveSelectedJob.model}</strong>
                  </div>
                )}
                {'reasoningEffort' in effectiveSelectedJob && (
                  <div className="settings-meta-chip">
                    <span>effort</span>
                    <strong>{effectiveSelectedJob.reasoningEffort}</strong>
                  </div>
                )}
                <div className="settings-meta-chip">
                  <span>阶段</span>
                  <strong>{effectiveSelectedJob.stage ?? 'queued'}</strong>
                </div>
              </div>

              {'promptPreview' in effectiveSelectedJob ? (
                <div className="prompt-editor-card">
                  <span>Prompt</span>
                  <textarea
                    value={props.promptDraft}
                    onChange={(event) => props.onPromptDraftChange(event.target.value)}
                  />
                </div>
              ) : (
                <div className="control-empty">这个任务类型没有可编辑 prompt。</div>
              )}

              {'liveText' in effectiveSelectedJob && effectiveSelectedJob.liveText && (
                <div className="prompt-editor-card">
                  <span>实时输出</span>
                  <div className="job-live-preview">{effectiveSelectedJob.liveText}</div>
                </div>
              )}

              {'liveLogs' in effectiveSelectedJob && effectiveSelectedJob.liveLogs && effectiveSelectedJob.liveLogs.length > 0 && (
                <div className="job-log-list tall">
                  {effectiveSelectedJob.liveLogs.slice(-24).map((line, index) => (
                    <div key={`${effectiveSelectedJob.id}-live-log-${index}`} className="job-log-line">{line}</div>
                  ))}
                </div>
              )}

              {'logs' in effectiveSelectedJob && effectiveSelectedJob.logs.length > 0 && (
                <div className="job-log-list tall">
                  {effectiveSelectedJob.logs.slice(-24).map((line, index) => (
                    <div key={`${effectiveSelectedJob.id}-log-${index}`} className="job-log-line">{line}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="control-empty">从左侧选一个任务，就可以看当前阶段、编辑 prompt、终止或重跑。</div>
          )}
        </section>
      </div>
    </OverlayDrawer>
  )
}

export function FirstRunDialog(props: {
  onOpenSettings: () => void
  onQuickStart: () => void
  onSkip: () => void
  open: boolean
  settings: SourcesSettingsSnapshot | null
}) {
  const config = props.settings?.config
  return (
    <AnimatePresence initial={false}>
      {props.open && config && (
        <>
          <motion.div className="overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section
            className="first-run-dialog"
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
          >
            <div className="first-run-hero">
              <div className="first-run-badge">
                <Settings2 size={16} />
                首次使用
              </div>
              <h2>先接主线文档和题库，再把你自己的工作集挂进来</h2>
              <p>OfferPotato 面向任意领域面试。开始前请先确认本机可用 `codex` / `codex-cli`。默认会直接使用仓库内公开资料，你也可以换成自己的本地目录或 Git 仓库。</p>
            </div>

            <div className="settings-meta-grid">
              <div className="settings-meta-chip">
                <span>主线文档</span>
                <strong>{config.guides.length}</strong>
              </div>
              <div className="settings-meta-chip">
                <span>面经题库</span>
                <strong>{config.questionBanks.length}</strong>
              </div>
              <div className="settings-meta-chip wide">
                <span>mywork</span>
                <strong>{config.myWork.path ?? config.myWork.url ?? config.myWork.id}</strong>
              </div>
            </div>

            <div className="first-run-checklist">
              <div className="settings-tip-card">
                <strong>你需要准备</strong>
                <p>1. `codex` / `codex-cli` 2. 你的工作集目录 3. 至少一套主线文档或默认公开文档源。</p>
              </div>
              <div className="settings-tip-card">
                <strong>默认公开源</strong>
                <p>仓库内 `sources/documents` 和 `sources/question-banks` 会自动识别，开箱即用；之后也能继续扩展成任何领域的文档与题库。</p>
              </div>
            </div>

            <div className="first-run-actions">
              <button className="primary-button" onClick={props.onQuickStart}>
                <Play size={16} />
                一键使用当前默认来源
              </button>
              <button className="ghost-button" onClick={props.onOpenSettings}>
                <FolderInput size={16} />
                先自定义来源
              </button>
              <button className="ghost-button" onClick={props.onSkip}>
                先直接进入
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}

export function OverlayDrawer(props: DrawerProps) {
  return (
    <AnimatePresence initial={false}>
      {props.open && (
        <>
          <motion.button
            aria-label="Close drawer"
            className="control-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={props.onClose}
          />
          <motion.aside
            className={`control-drawer${props.className ? ` ${props.className}` : ''}`}
            initial={{ opacity: 0, x: 34, scale: 0.986 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 28, scale: 0.992 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.92 }}
          >
            <div className="control-drawer-head">
              <div className="drawer-head-copy">
                <div className="drawer-head-title">
                  {props.icon ? <span className="drawer-head-icon-shell">{props.icon}</span> : null}
                  <strong>{props.title}</strong>
                </div>
                {props.description ? (
                  <p className="drawer-head-description">{props.description}</p>
                ) : null}
              </div>
              <div className="drawer-head-actions">
                {props.headerActions}
                <button className="ghost-button icon-button drawer-close-button" onClick={props.onClose} type="button">
                  <X size={16} />
                </button>
              </div>
            </div>
            {props.children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function SourceGroupEditor(props: {
  items: SourcesConfig['guides'] | SourcesConfig['questionBanks']
  label: string
  onChange: (next: SourcesConfig['guides']) => void
  templateKind: 'guide' | 'question_bank'
}) {
  return (
    <div className="source-group-editor">
      <div className="source-group-head">
        <span>{props.label}</span>
        <button
          aria-label={`添加${props.label}`}
          className="ghost-button icon-button"
          onClick={() => props.onChange([
            ...props.items,
            {
              branch: 'main',
              id: `${props.templateKind}-${props.items.length + 1}`,
              kind: props.templateKind,
              path: '',
              type: 'local'
            }
          ])}
          title={`添加${props.label}`}
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="source-entry-list">
        {props.items.map((item, index) => (
          <SourceEntryEditor
            key={`${item.id}-${index}`}
            canRemove={props.items.length > 1 || props.templateKind === 'question_bank'}
            value={item}
            onChange={(next) => {
              const updated = [...props.items]
              updated[index] = next
              props.onChange(updated)
            }}
            onRemove={() => props.onChange(props.items.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))}
      </div>
    </div>
  )
}

function SourceEntryEditor(props: {
  canRemove: boolean
  onChange: (next: SourcesConfig['guides'][number]) => void
  onRemove: () => void
  value: SourcesConfig['guides'][number]
}) {
  const value = props.value
  return (
    <div className="source-entry-card">
      <div className="source-entry-head">
        <input
          className="source-id-input"
          value={value.id}
          onChange={(event) => props.onChange({ ...value, id: event.target.value })}
        />
        <select
          value={value.type}
          onChange={(event) => props.onChange({
            ...value,
            path: event.target.value === 'local' ? value.path ?? '' : undefined,
            type: event.target.value as 'git' | 'local',
            url: event.target.value === 'git' ? value.url ?? '' : undefined
          })}
        >
          <option value="local">本地目录</option>
          <option value="git">Git 仓库</option>
        </select>
        {props.canRemove && (
          <button className="ghost-button danger-button" onClick={props.onRemove}>移除</button>
        )}
      </div>

      {value.type === 'git' ? (
        <label className="field">
          <span><GitBranch size={14} /> Git 地址</span>
          <input value={value.url ?? ''} onChange={(event) => props.onChange({ ...value, url: event.target.value })} />
        </label>
      ) : (
        <label className="field">
          <span><FolderInput size={14} /> 本地目录</span>
          <input value={value.path ?? ''} onChange={(event) => props.onChange({ ...value, path: event.target.value })} />
        </label>
      )}

      {value.type === 'git' && (
        <label className="field">
          <span>分支</span>
          <input value={value.branch ?? 'main'} onChange={(event) => props.onChange({ ...value, branch: event.target.value })} />
        </label>
      )}
    </div>
  )
}

function WorkSourceEditor(props: {
  autoDetectedMyWorkPath: string | null
  onChange: (next: SourcesConfig['myWork']) => void
  value: SourcesConfig['myWork']
}) {
  const value = props.value
  return (
    <div className="source-group-editor">
      <div className="source-group-head">
        <span>个人工作集</span>
        {props.autoDetectedMyWorkPath && (
          <button
            className="ghost-button"
            onClick={() => props.onChange({
              ...value,
              path: props.autoDetectedMyWorkPath ?? value.path
            })}
          >
            使用自动探测路径
          </button>
        )}
      </div>

      <div className="source-entry-card">
        <div className="source-entry-head">
          <input
            className="source-id-input"
            value={value.id}
            onChange={(event) => props.onChange({ ...value, id: event.target.value })}
          />
          <select
            value={value.type}
            onChange={(event) => props.onChange({
              ...value,
              path: event.target.value === 'local' ? value.path ?? '' : undefined,
              type: event.target.value as 'git' | 'local',
              url: event.target.value === 'git' ? value.url ?? '' : undefined
            })}
          >
            <option value="local">本地目录</option>
            <option value="git">Git 仓库</option>
          </select>
        </div>

        {value.type === 'git' ? (
          <label className="field">
            <span><GitBranch size={14} /> Git 地址</span>
            <input value={value.url ?? ''} onChange={(event) => props.onChange({ ...value, url: event.target.value })} />
          </label>
        ) : (
          <label className="field">
            <span><FolderInput size={14} /> mywork 目录</span>
            <input value={value.path ?? ''} onChange={(event) => props.onChange({ ...value, path: event.target.value })} />
          </label>
        )}

        {value.type === 'git' && (
          <label className="field">
            <span>分支</span>
            <input value={value.branch ?? 'main'} onChange={(event) => props.onChange({ ...value, branch: event.target.value })} />
          </label>
        )}

        <label className="field">
          <span>工作 manifest</span>
          <input value={value.manifestPath ?? './config/work-manifest.runtime.json'} onChange={(event) => props.onChange({ ...value, manifestPath: event.target.value })} />
        </label>
      </div>
    </div>
  )
}

function TypographySlider(props: {
  icon: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="typography-slider" title={props.label}>
      <div className="typography-slider-head">
        <div className="typography-slider-label">
          <span className="slider-glyph" aria-hidden="true">{props.icon}</span>
          <span>{props.label}</span>
        </div>
        <strong>{props.value}</strong>
      </div>
      <input
        max={props.max}
        min={props.min}
        step={props.step}
        type="range"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  )
}

type InterviewerGroup = {
  id: string
  jobs: InterviewerAgentJob[]
  kind: 'interviewer_group'
  latestJob: InterviewerAgentJob
  questionId: string
  title: string
}

type JobEntry = AgentJob | InterviewerGroup
type InterviewerAgentJob = Extract<AgentJob, { kind: 'interviewer' }>

function buildJobEntries(jobs: AgentJob[], selectedJob: AgentJob | null) {
  const interviewerJobs = jobs.filter(isInterviewerJob)
  const otherJobs = jobs.filter((job) => !isInterviewerJob(job))
  const interviewerGroups = new Map<string, InterviewerAgentJob[]>()

  for (const job of interviewerJobs) {
    const current = interviewerGroups.get(job.questionId) ?? []
    current.push(job)
    interviewerGroups.set(job.questionId, current)
  }

  const grouped = [...interviewerGroups.entries()].map(([questionId, groupJobs]) => {
    const sorted = groupJobs.slice().sort((left, right) => right.startedAt.localeCompare(left.startedAt, 'en'))
    const latestJob = sorted[0]
    return {
      id: `interviewer-group:${questionId}`,
      jobs: sorted,
      kind: 'interviewer_group' as const,
      latestJob,
      questionId,
      title: latestJob.questionText?.trim() || latestJob.seedFollowUp || '压力面'
    }
  })

  const runningEntries = [
    ...otherJobs.filter((job) => job.status === 'queued' || job.status === 'running'),
    ...grouped.filter((group) => group.jobs.some((job) => job.status === 'queued' || job.status === 'running'))
  ].sort(compareJobEntries)

  const historyEntries = [
    ...otherJobs.filter((job) => job.status !== 'queued' && job.status !== 'running'),
    ...grouped.filter((group) => group.jobs.every((job) => job.status !== 'queued' && job.status !== 'running'))
  ].sort(compareJobEntries)

  const interviewerGroup = selectedJob && isInterviewerJob(selectedJob)
    ? grouped.find((group) => group.questionId === selectedJob.questionId) ?? null
    : null

  return {
    historyEntries,
    interviewerGroup,
    runningEntries
  }
}

function compareJobEntries(left: JobEntry, right: JobEntry) {
  return readJobEntryStartedAt(right).localeCompare(readJobEntryStartedAt(left), 'en')
}

function readJobEntryStartedAt(entry: JobEntry) {
  return isInterviewerGroup(entry) ? entry.latestJob.startedAt : entry.startedAt
}

function isInterviewerJob(job: AgentJob): job is InterviewerAgentJob {
  return job.kind === 'interviewer'
}

function isInterviewerGroup(entry: JobEntry): entry is InterviewerGroup {
  return 'kind' in entry && entry.kind === 'interviewer_group'
}

function renderJobEntryCard(
  entry: JobEntry,
  selectedInterviewerGroup: InterviewerGroup | null,
  selectedJob: AgentJob | null,
  onSelectJob: (jobId: string) => void,
  compact = false
) {
  if (isInterviewerGroup(entry)) {
    const latest = entry.latestJob
    const isActive = selectedInterviewerGroup?.questionId === entry.questionId
    const hasRunning = entry.jobs.some((job) => job.status === 'running')
    const hasQueued = entry.jobs.some((job) => job.status === 'queued')
    const stackStatus = hasRunning ? 'running' : hasQueued ? 'queued' : latest.status

    return (
      <button
        key={entry.id}
        className={`agent-job-card interviewer-job-stack ${compact ? 'compact' : ''} ${isActive ? 'active' : ''}`}
        onClick={() => onSelectJob(latest.id)}
      >
        <div className="agent-job-stack-layers" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="agent-job-top">
          <span className="pill subtle kind-interviewer">面试官</span>
          <span className={`pill ${stackStatus === 'ready' ? 'success' : ''}`}>{entry.jobs.length} 轮</span>
        </div>
        <strong>{entry.title}</strong>
        <p>{latest.summary ?? latest.seedFollowUp ?? '面试官压力面任务'}</p>
        <small>{`${describeJobStatus(stackStatus)} · ${latest.stage ?? 'queued'}`}</small>
      </button>
    )
  }

  return (
    <button
      key={entry.id}
      className={`agent-job-card ${compact ? 'compact' : ''} ${selectedJob?.id === entry.id ? 'active' : ''}`}
      onClick={() => onSelectJob(entry.id)}
    >
      <div className="agent-job-top">
        <span className={`pill subtle kind-${entry.kind}`}>{describeJobKind(entry.kind)}</span>
        <span className={`pill ${entry.status === 'ready' ? 'success' : ''}`}>{describeJobStatus(entry.status)}</span>
      </div>
      <strong>{readJobTitle(entry)}</strong>
      <p>{entry.summary ?? readJobSummary(entry)}</p>
      {!compact && <small>{entry.stage ?? 'queued'}</small>}
    </button>
  )
}

function InterviewerHistoryReplyCard(props: {
  reply: InterviewerReply
}) {
  return (
    <div className="console-assistant-card interviewer-history-reply-card">
      <div className="interviewer-history-reply-head">
        <span className={`console-mode-pill interviewer-level ${props.reply.pressure_level}`}>
          {describePressureLevel(props.reply.pressure_level)}
        </span>
        <strong>{props.reply.headline}</strong>
      </div>
      <p className="console-summary">{props.reply.summary}</p>
      {props.reply.assessment && (
        <div className="interviewer-assessment-box compact">
          <span>点评</span>
          <p>{props.reply.assessment}</p>
        </div>
      )}
      <div className="console-markdown interviewer-markdown">
        <ReactMarkdown
          rehypePlugins={[rehypeKatex]}
          remarkPlugins={[remarkGfm, remarkMath]}
        >
          {normalizeMarkdownForRender(props.reply.interviewer_markdown)}
        </ReactMarkdown>
      </div>
      {props.reply.follow_ups.length > 0 && (
        <div className="console-follow-up-row">
          {props.reply.follow_ups.map((item) => (
            <div key={item} className="console-follow-up-chip interviewer-chip">{item}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatJobStartedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  })
}

function describePressureLevel(level: InterviewerReply['pressure_level']) {
  if (level === 'cornering') {
    return '压墙追问'
  }
  if (level === 'pressure') {
    return '高压深挖'
  }
  return '开场施压'
}

function describeJobKind(kind: AgentJob['kind']) {
  if (kind === 'index') {
    return '索引'
  }
  if (kind === 'interviewer') {
    return '面试官'
  }
  if (kind === 'console') {
    return '控制台'
  }
  return '答案'
}

function describeJobStatus(status: AgentJob['status']) {
  if (status === 'running') {
    return '运行中'
  }
  if (status === 'queued') {
    return '排队中'
  }
  if (status === 'ready') {
    return '已完成'
  }
  if (status === 'failed') {
    return '失败'
  }
  return '已取消'
}

function readJobTitle(job: AgentJob) {
  if (job.kind === 'index') {
    return '重建知识索引'
  }
  if (job.kind === 'interviewer') {
    return job.questionText?.trim() || job.seedFollowUp || '压力面'
  }
  if (job.kind === 'console') {
    return job.messagePreview?.trim() || '受管 Codex 会话'
  }
  return job.questionText?.trim() || job.questionId
}

function readJobSummary(job: AgentJob) {
  if (job.kind === 'index') {
    return job.summary
  }
  if (job.kind === 'interviewer') {
    return job.summary ?? job.seedFollowUp ?? '面试官压力面任务'
  }
  if (job.kind === 'console') {
    return job.summary ?? job.messagePreview ?? '受管控制台任务'
  }
  return job.summary ?? job.questionText ?? '个性化答案任务'
}

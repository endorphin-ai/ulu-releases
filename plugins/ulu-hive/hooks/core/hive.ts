// The hive of one run: the bees (subagents) El Capitan sends, what each is
// doing, its steps, tokens and cost, and El Capitan's own plan. Plain data and
// pure functions, so the hooks stay thin and the tests need no engine.

import { redact, shortPath } from './redact'

import type { Bee, BeeStatus, Run, Step, StepStatus, Usage } from '../../types'

export type { Bee, BeeStatus, Run, Step, StepStatus, Usage }

export const emptyRun = (title: string, now: number): Run => ({
  title,
  startedAt: now,
  endedAt: 0,
  isMainBusy: true,
  mainTokens: 0,
  mainCacheRead: 0,
  window: 0,
  mainCostUsd: 0,
  doing: '',
  plan: [],
  bees: [],
  costBase: -1,
  exactCost: -1,
})

// The session's ledger says what everything has cost: the run's part of it.
export function setLedger(run: Run, sessionUsd: number | undefined, window?: number): Run {
  if (window) run = { ...run, window }
  if (sessionUsd === undefined) return run
  if (run.costBase < 0) return { ...run, costBase: sessionUsd, exactCost: 0 }
  return { ...run, exactCost: Math.max(0, sessionUsd - run.costBase) }
}

export const isRunning = (run: Run | null): boolean =>
  !!run && (run.isMainBusy || run.bees.some(b => b.status === 'running'))

// A new prompt starts a new run, unless bees of the last one still work.
export function startRun(run: Run | null, text: string, cwd: string, now: number): Run {
  const title = runTitle(text, cwd)
  if (run && run.bees.some(b => b.status === 'running')) {
    return { ...run, isMainBusy: true, endedAt: 0 }
  }
  return emptyRun(title, now)
}

export function runTitle(text: string, cwd: string): string {
  let t = text.trim().split('\n')[0] ?? ''
  t = t.replace(/^\/el-capitan\s*/i, '').replace(/^\/[\w:-]+\s*/, m => (t.length === m.length ? m : ''))
  t = redact(t, cwd)
  if (t.length > 60) t = t.slice(0, 59) + '…'
  return t || 'El Capitan'
}

export function endMain(run: Run, now: number): Run {
  return settle({ ...run, isMainBusy: false, doing: '' }, now)
}

// A bee that was woken again (SendMessage) works again.
export function wakeBee(run: Run, agentId: string): Run {
  const next = withBee(run, agentId, b =>
    b.status === 'running' ? b : { ...b, status: 'running', endedAt: 0, doing: 'Working', round: b.round + 1 },
  )
  return next === run ? run : { ...next, endedAt: 0 }
}

// The run has ended when El Capitan and every bee have.
function settle(run: Run, now: number): Run {
  if (isRunning(run)) return { ...run, endedAt: 0 }
  return run.endedAt ? run : { ...run, endedAt: now }
}

export function addBee(
  run: Run,
  a: { id: string; role: string; title: string; model: string },
  now: number,
): Run {
  if (run.bees.some(b => b.id === a.id)) return run
  const bee: Bee = {
    id: a.id,
    role: a.role,
    title: redact(a.title, '') || a.role,
    bee: beeFor(`${a.role} ${a.title}`),
    model: a.model,
    effort: '',
    status: 'running',
    startedAt: now,
    endedAt: 0,
    tokens: 0,
    cacheRead: 0,
    round: 1,
    nth: run.bees.filter(b => b.role === a.role).length + 1,
    costUsd: 0,
    ctxTokens: 0,
    doing: 'Starting',
    steps: [],
  }
  return { ...run, endedAt: 0, bees: [...run.bees, bee] }
}

// New tokens: what the request added. The cache reads are the context sent
// again, counted apart: summed over requests they come to millions.
const tokensOf = (u: Usage) =>
  (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

// One model request ended: its tokens and cost go to the bee, or to El
// Capitan when agentId is empty.
export function addUsage(
  run: Run,
  agentId: string | undefined,
  usage: Usage,
  model: string,
  effort: string,
): Run {
  const tokens = tokensOf(usage)
  const cached = usage.cache_read_input_tokens ?? 0
  const cost = costOf(model, usage)
  if (!agentId) {
    return { ...run, mainTokens: run.mainTokens + tokens, mainCacheRead: run.mainCacheRead + cached, mainCostUsd: run.mainCostUsd + cost }
  }
  return withBee(run, agentId, b => ({
    ...b,
    model: model || b.model,
    effort: effort || b.effort,
    tokens: b.tokens + tokens,
    cacheRead: b.cacheRead + cached,
    costUsd: b.costUsd + cost,
    ctxTokens:
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
  }))
}

export function endBee(run: Run, agentId: string, reason: string, now: number): Run {
  const status: BeeStatus = reason === 'aborted' ? 'stopped' : reason === 'answer' ? 'done' : 'failed'
  const next = withBee(run, agentId, b =>
    b.status === 'running' ? { ...b, status, endedAt: now, doing: '' } : b,
  )
  return settle(next, now)
}

// A tool call starts: it says what the bee (or El Capitan) does now.
export function sawTool(
  run: Run,
  agentId: string | undefined,
  tool: string,
  input: Record<string, unknown>,
  cwd: string,
): Run {
  const doing = doingOf(tool, input, cwd)
  let next = agentId ? withBee(run, agentId, b => ({ ...b, doing })) : { ...run, doing }
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    const steps: Step[] = (input.todos as { content?: unknown; status?: unknown }[]).map((t, i) => ({
      id: `todo-${i}`,
      subject: redact(String(t.content ?? ''), cwd),
      status: stepStatus(t.status),
      blockedBy: [],
    }))
    next = setSteps(next, agentId, list => [...list.filter(s => !s.id.startsWith('todo-')), ...steps])
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    const status = String(input.status ?? '')
    const after = Array.isArray(input.addBlockedBy) ? input.addBlockedBy.map(String) : []
    next = setSteps(next, agentId, list =>
      status === 'deleted'
        ? list.filter(s => s.id !== id)
        : list.map(s =>
            s.id === id
              ? {
                  ...s,
                  status: status ? stepStatus(status) : s.status,
                  subject: typeof input.subject === 'string' ? redact(input.subject, cwd) : s.subject,
                  blockedBy: [...new Set([...s.blockedBy, ...after])],
                }
              : s,
          ),
    )
  }
  return next
}

// A TaskCreate answered: its id is in the result.
export function createdStep(
  run: Run,
  agentId: string | undefined,
  input: Record<string, unknown>,
  result: unknown,
  cwd: string,
): Run {
  const id = taskIdOf(result)
  if (!id) return run
  const step: Step = {
    id,
    subject: redact(String(input.subject ?? ''), cwd),
    status: 'pending',
    blockedBy: Array.isArray(input.blockedBy) ? input.blockedBy.map(String) : [],
  }
  return setSteps(run, agentId, list => (list.some(s => s.id === id) ? list : [...list, step]))
}

export function taskIdOf(result: unknown): string {
  const seen = new Set<unknown>()
  const walk = (v: unknown): string => {
    if (v == null || seen.has(v)) return ''
    if (typeof v === 'string') return /Task #(\d+) created/.exec(v)?.[1] ?? ''
    if (typeof v !== 'object') return ''
    seen.add(v)
    const o = v as Record<string, unknown>
    const task = o.task as Record<string, unknown> | undefined
    if (task && (typeof task.id === 'string' || typeof task.id === 'number')) return String(task.id)
    for (const k of ['text', 'result', 'content']) {
      const got = walk(o[k])
      if (got) return got
    }
    if (Array.isArray(v)) for (const x of v) { const got = walk(x); if (got) return got }
    return ''
  }
  return walk(result)
}

function stepStatus(s: unknown): StepStatus {
  return s === 'completed' || s === 'in_progress' ? s : 'pending'
}

function setSteps(run: Run, agentId: string | undefined, fn: (s: Step[]) => Step[]): Run {
  return agentId ? withBee(run, agentId, b => ({ ...b, steps: fn(b.steps) })) : { ...run, plan: fn(run.plan) }
}

function withBee(run: Run, id: string, fn: (b: Bee) => Bee): Run {
  if (!run.bees.some(b => b.id === id)) return run
  return { ...run, bees: run.bees.map(b => (b.id === id ? fn(b) : b)) }
}

// What a tool call does, in a few words. Paths are made short, commands cut
// and searched for secrets: a pane is often shared on screen.
export function doingOf(tool: string, input: Record<string, unknown>, cwd: string): string {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const cut = (t: string, n = 48) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
  switch (tool) {
    case 'Read':
      return `Reading ${shortPath(s('file_path'), cwd)}`
    case 'Edit':
    case 'MultiEdit':
      return `Editing ${shortPath(s('file_path'), cwd)}`
    case 'Write':
      return `Writing ${shortPath(s('file_path'), cwd)}`
    case 'NotebookEdit':
      return `Editing ${shortPath(s('notebook_path'), cwd)}`
    case 'Bash':
      return `Running ${cut(redact(s('command').split('\n')[0] ?? '', cwd))}`
    case 'Grep':
    case 'Glob':
      return `Searching ${cut(redact(s('pattern'), cwd), 32)}`
    case 'WebFetch': {
      const host = /^https?:\/\/([^/?#]+)/.exec(s('url'))?.[1]
      return host ? `Reading ${host}` : 'Reading the web'
    }
    case 'WebSearch':
      return 'Searching the web'
    case 'Agent':
    case 'Task':
      return `Sending a bee: ${cut(redact(s('description'), cwd), 36)}`
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TodoWrite':
      return 'Planning'
    case 'AskUserQuestion':
      return 'Asking you'
    case 'Skill':
      return `Using ${cut(s('skill'), 32)}`
  }
  const mcp = /^mcp__([^_]+(?:_[^_]+)*)__/.exec(tool)
  if (mcp) return `Using ${mcp[1]}`
  return tool
}

// beeFor picks the bee picture from a name, as ULU's window does. Short names
// such as "pm" or "ui" must be whole words.
export function beeFor(text: string): string {
  const t = text.toLowerCase()
  const words = new Set(t.split(/[^a-z0-9]+/).filter(Boolean))
  const word = (...l: string[]) => l.some(w => words.has(w))
  const part = (...l: string[]) => l.some(w => t.includes(w))
  if (part('capitan', 'orchestrat')) return 'capitan'
  if (part('security', 'guardian')) return 'security'
  if (part('devops', 'deploy', 'infra', 'operator', 'release')) return 'devops'
  if (word('qa', 'qe') || part('tester')) return 'qe'
  if (part('architect', 'techlead', 'tech lead', 'reviewer', 'code review') || word('lead')) return 'lead'
  if (word('test', 'tests') || part('testing', 'quality')) return 'qe'
  if (word('ux') || part('design', 'creative')) return 'designer'
  if (word('ui', 'web') || part('frontend', 'front-end')) return 'frontend'
  if (word('pm') || part('product', 'requirement', 'planner')) return 'pm'
  return 'dev'
}

// What a planned step's bee is called, before a real one takes it.
export const beeName = (bee: string): string =>
  ({ capitan: 'El Capitan', pm: 'PM', lead: 'lead', dev: 'dev', frontend: 'frontend', designer: 'designer',
     qe: 'tester', security: 'security', devops: 'devops' })[bee] ?? bee

// Prices per million tokens: input, output. A cache write costs 1.25 times
// the input, a cache read a tenth. An estimate: the session's own total is
// exact and shown at the top.
const PRICES: [RegExp, number, number][] = [
  [/opus/i, 5, 25],
  [/sonnet/i, 3, 15],
  [/haiku/i, 1, 5],
  [/fable/i, 5, 25],
]

export function costOf(model: string, u: Usage): number {
  const p = PRICES.find(([re]) => re.test(model)) ?? [/./, 3, 15]
  const [, inP, outP] = p
  return (
    ((u.input_tokens ?? 0) * inP +
      (u.output_tokens ?? 0) * outP +
      (u.cache_creation_input_tokens ?? 0) * inP * 1.25 +
      (u.cache_read_input_tokens ?? 0) * inP * 0.1) /
    1e6
  )
}

// The window a bee's context fills: the session's own when known, else 1M
// for a model named so, else 200k; never less than what it already holds.
export const contextWindow = (model: string, sessionWindow = 0, holds = 0) => {
  const w = sessionWindow || (/\[1m\]|-1m\b/i.test(model) ? 1_000_000 : 200_000)
  return holds > w ? 1_000_000 : w
}

export function shortModel(model: string): string {
  const m = /(opus|sonnet|haiku|fable)[-\s]?(\d+)(?:[-.](\d+))?/i.exec(model)
  if (!m) return model
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase()
  return m[3] && m[3].length <= 2 ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

// Bees in the order they show: running, then finished; planned steps after.
export function sections(run: Run) {
  const running = run.bees.filter(b => b.status === 'running')
  const finished = run.bees.filter(b => b.status !== 'running')
  const order = new Map(run.plan.map((s, i) => [s.id, i + 1]))
  const planned = run.plan
    .map((s, i) => ({ ...s, n: i + 1, after: s.blockedBy.map(id => order.get(id)).filter((x): x is number => !!x) }))
    .filter(s => s.status === 'pending')
  return { running, finished, planned }
}

export function totals(run: Run) {
  const tokens = run.mainTokens + run.bees.reduce((n, b) => n + b.tokens, 0)
  const cacheRead = run.mainCacheRead + run.bees.reduce((n, b) => n + b.cacheRead, 0)
  const estimate = run.mainCostUsd + run.bees.reduce((n, b) => n + b.costUsd, 0)
  const isExact = run.exactCost >= 0 && run.exactCost >= estimate * 0.5
  return { tokens, cacheRead, cost: isExact ? run.exactCost : estimate, isExact }
}

export const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

export const fmtCost = (usd: number) => (usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

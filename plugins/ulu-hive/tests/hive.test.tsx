import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  addBee,
  addUsage,
  beeFor,
  createdStep,
  doingOf,
  endBee,
  endMain,
  isRunning,
  runTitle,
  sawTool,
  sections,
  setLedger,
  shortModel,
  startRun,
  taskIdOf,
  totals,
  wakeBee,
} from '../hooks/core/hive'
import { redact } from '../hooks/core/redact'
import { ROLE_COLOR, darken, ink } from '../hooks/core/draw'
import type { Run } from '../types'

const CWD = '/Users/someone/code/app'

function aRun(): Run {
  let r = startRun(null, '/el-capitan Build the launch kit', CWD, 1000)
  r = addBee(r, { id: 'a1', role: 'frontend-dev', title: 'Build the landing page', model: 'claude-opus-5-5' }, 2000)
  r = addBee(r, { id: 'a2', role: 'designer', title: 'Design the launch graphics', model: 'claude-sonnet-5-5' }, 2000)
  r = sawTool(r, 'a1', 'TodoWrite', { todos: [
    { content: 'Hero', status: 'completed' },
    { content: 'Hero copy', status: 'in_progress' },
    { content: 'Footer', status: 'pending' },
  ] }, CWD)
  r = addUsage(r, 'a1', { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 30000 }, 'claude-opus-5-5', 'low')
  r = endBee(r, 'a2', 'answer', 20000)
  return r
}

test('a run follows its bees', async () => {
  const r = aRun()
  expect(r.title).toBe('Build the launch kit')
  const { running, finished } = sections(r)
  expect(running.map(b => b.id)).toEqual(['a1'])
  expect(finished.map(b => b.status)).toEqual(['done'])
  expect(running[0]!.bee).toBe('frontend')
  expect(running[0]!.effort).toBe('low')
  expect(running[0]!.tokens).toBe(33000)
  expect(running[0]!.ctxTokens).toBe(31000)
  expect(running[0]!.steps.map(s => s.status)).toEqual(['completed', 'in_progress', 'pending'])
  expect(isRunning(r)).toBe(true)

  // El Capitan ends its turn while a bee works: the run goes on.
  let r2 = endMain(r, 30000)
  expect(r2.endedAt).toBe(0)
  r2 = endBee(r2, 'a1', 'answer', 40000)
  expect(r2.endedAt).toBe(40000)
  expect(isRunning(r2)).toBe(false)
  // A bee woken again works again.
  expect(isRunning(wakeBee(r2, 'a1'))).toBe(true)
})

test('a new prompt keeps a run whose bees still work', async () => {
  const r = aRun()
  expect(startRun(r, 'and also this', CWD, 50000).bees.length).toBe(2)
  const done = endBee(endMain(r, 1), 'a1', 'answer', 2)
  expect(startRun(done, 'next', CWD, 50000).bees.length).toBe(0)
})

test('El Capitan plans with TaskCreate, and the planned steps wait', async () => {
  let r = startRun(null, 'go', CWD, 0)
  r = createdStep(r, undefined, { subject: 'Build' }, { result: 'Task #1 created successfully' }, CWD)
  r = createdStep(r, undefined, { subject: 'Design' }, { text: 'Task #2 created' }, CWD)
  r = createdStep(r, undefined, { subject: 'Review the whole kit' }, { result: { task: { id: 3 } } }, CWD)
  r = sawTool(r, undefined, 'TaskUpdate', { taskId: '3', addBlockedBy: ['1', '2'] }, CWD)
  r = sawTool(r, undefined, 'TaskUpdate', { taskId: '1', status: 'completed' }, CWD)
  r = sawTool(r, undefined, 'TaskUpdate', { taskId: '2', status: 'in_progress' }, CWD)
  const { planned } = sections(r)
  expect(planned.map(s => [s.n, s.subject, s.after])).toEqual([[3, 'Review the whole kit', [1, 2]]])
  // TodoWrite keeps the TaskCreate steps.
  r = sawTool(r, undefined, 'TodoWrite', { todos: [{ content: 'x', status: 'pending' }] }, CWD)
  expect(r.plan.length).toBe(4)
})

test('task ids are read from every shape', async () => {
  expect(taskIdOf('Task #7 created')).toBe('7')
  expect(taskIdOf({ result: { task: { id: '12' } } })).toBe('12')
    expect(taskIdOf({ content: [{ text: 'Task #4 created' }] })).toBe('4')
  expect(taskIdOf(null)).toBe('')
})

test('what a bee does is shown without secrets', async () => {
  expect(doingOf('Edit', { file_path: `${CWD}/src/hero.tsx` }, CWD)).toBe('Editing src/hero.tsx')
  expect(doingOf('Read', { file_path: '/etc/hosts' }, CWD)).toBe('Reading /etc/hosts')
  expect(doingOf('Bash', { command: 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz npm test' }, CWD)).not.toContain('ghp_')
  expect(doingOf('Bash', { command: 'curl -H "Authorization: Bearer eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.abc"' }, CWD)).not.toContain('eyJ')
  expect(doingOf('WebFetch', { url: 'https://example.com/a?key=1' }, CWD)).toBe('Reading example.com')
  expect(doingOf('mcp__render__list_services', {}, CWD)).toBe('Using render')
  expect(redact(`cat ${CWD}/.env && cat /Users/other/x`, CWD)).toBe('cat .env && cat ~/x')
  expect(redact('export RENDER_API_KEY=rnd_abcdefghijklmnop', CWD)).not.toContain('rnd_')
  expect(redact('mail me at a@b.co', CWD)).toBe('mail me at [e-mail]')
  expect(redact('--password hunter2 ok', CWD)).toBe('--password [hidden] ok')
  expect(runTitle('/el-capitan sk-ant-abcdefghijklmnopqrstuv do it', CWD)).not.toContain('sk-ant')
})

test('bees get the picture of their role', async () => {
  expect(beeFor('go-tester-gocli')).toBe('qe')
  expect(beeFor('reviewer-gocli code review')).toBe('lead')
  expect(beeFor('pm-gocli')).toBe('pm')
  expect(beeFor('development')).toBe('dev')
  expect(beeFor('tui-dev-gocli')).toBe('dev')
  expect(beeFor('Design the launch graphics')).toBe('designer')
  expect(shortModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(shortModel('claude-haiku-5-5-20261001')).toBe('Haiku 5.5')
})

test('the cost is the ledger once known, else the estimate', async () => {
  let r = setLedger(startRun(null, 'x', CWD, 0), 10)
  r = addBee(r, { id: 'a', role: 'dev', title: 't', model: 'claude-opus-5-5' }, 0)
  r = addUsage(r, 'a', { output_tokens: 10000 }, 'claude-opus-5-5', '')
  expect(totals(r).isExact).toBe(false) // the ledger has not moved yet
  r = setLedger(r, 10.3)
  expect(totals(r)).toEqual({ tokens: 10000, cost: 0.3000000000000007, isExact: true })
})

test('chips get words that read on their color', async () => {
  // Every chip, bright or darkened, has a contrast of at least 4.5 (WCAG AA).
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255)
  }
  const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
  for (const c of Object.values(ROLE_COLOR)) {
    expect(contrast(c, ink(c))).toBeGreaterThan(4.5)
    expect(contrast(darken(c), ink(darken(c)))).toBeGreaterThan(4.5)
  }
  expect(ink('#ffd34d')).toBe('#111111')
  expect(ink(darken('#ffd34d'))).toBe('#ffffff')
})

const PANE = {
  plugin: 'ulu-hive',
  component: 'Pane',
  requestId: 'ulu-hive',
  props: {
    title: 'ULU Hive',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('the pane draws the run on every surface', async ($, on) => {
  const r = aRun()
  on('clock.now', () => ({ value: 30000 }))
  on('state.get', (_$, e) => {
    const key = (e as { key: string }).key
    const value = key === 'run' ? { shape: 'run-1', value: r } : key === 'tick' ? 0 : false
    return { value: { value, version: 1 } }
  })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Build the launch kit/ }))?.text).toBe('Build the launch kit')
    expect(await ui.find({ type: 'Text', text: /Running · 1/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /Build the landing page/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /1\/3 · Hero copy/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /Finished · 1/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('the pane says what to do before any run', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No run yet/ })).toBeTruthy()
  await ui.unmount()
})

import { boardColumns, columnOf, parseItem } from '../hooks/core/board'

test('work items are read from their header', async () => {
  const story = parseItem('---\nid: US-003\ntitle: "Sign in with GitHub"\nstatus: In progress (blocked)\n---\n# x', 'dev-docs/user_stories/us-003.md', 'user_story')
  expect(story).toEqual({ path: 'dev-docs/user_stories/us-003.md', type: 'user_story', ref: 'US-003', title: 'Sign in with GitHub', status: 'In progress (blocked)', column: 'in_progress' })
  expect(parseItem('# Payments PRD\nbody', 'dev-docs/prd/payments.md', 'prd').title).toBe('Payments PRD')
  expect(parseItem('no header', 'dev-docs/prd/the-big-plan.md', 'prd').title).toBe('the big plan')
  expect(columnOf('Ready for review')).toBe('in_review')
  expect(columnOf('wont fix')).toBe('done')
  expect(columnOf('something odd')).toBe('todo')
  const { columns, apart, counts } = boardColumns({ docs: 'dev-docs', skipped: 0, readAt: 0, items: [
    story,
    parseItem('---\nstatus: accepted\n---\n# Use Postgres', 'dev-docs/decisions/d1.md', 'decision'),
    parseItem('---\nstatus: done\n---\n# Old', 'dev-docs/user_stories/us-001.md', 'user_story'),
  ] })
  expect(columns.map(c => c.column)).toEqual(['in_progress', 'done'])
  expect(apart.map(i => i.title)).toEqual(['Use Postgres'])
  expect(counts).toEqual([['user_story', { total: 2, done: 1 }], ['decision', { total: 1, done: 1 }]])
})

const FILES: Record<string, string> = {
  'dev-docs/user_stories/us-003.md': '---\nid: US-003\ntitle: Sign in with GitHub\nstatus: in progress\n---\n',
  'dev-docs/user_stories/template_user_story.md': '---\ntitle: TEMPLATE\n---\n',
  'dev-docs/risks/r1.md': '---\ntitle: The API may change\nstatus: open\n---\n',
}

// The engine hands the fs events absolute paths: the fake disk reads them
// from the project folder.
const rel = (e: unknown) => ((e as { path?: string }).path ?? '').replace(/^.*?\/(?=(dev-)?docs(\/|$))/, '')

function fakeDisk(on: On) {
  on('fs.exists', (_$, e) => ({ value: rel(e) === 'dev-docs' }))
  on('fs.list', (_$, e) => {
    const dir = rel(e)
    const names = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(FILES)) {
      if (!f.startsWith(dir + '/')) continue
      const rest = f.slice(dir.length + 1).split('/')
      names.set(rest[0]!, rest.length > 1 ? 'dir' : 'file')
    }
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 100, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_$, e) => ({ value: FILES[rel(e)] ?? '' }))
}

test('the tabs switch views with a click', async ($, on) => {
  on('clock.now', () => ({ value: 1 }))
  fakeDisk(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'tab-board' })
    expect(await ui.find({ type: 'Text', text: /In progress · 1/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /Sign in with GitHub/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /TEMPLATE/ })).toBeFalsy()
    expect(await ui.find({ type: 'Text', text: /Decisions and risks · 1/ })).toBeTruthy()
    await ui.press({ key: 'tab-stats' })
    expect(await ui.find({ type: 'Text', text: /No bees yet/ })).toBeTruthy()
    await ui.press({ key: 'tab-hive' })
    expect(await ui.find({ type: 'Text', text: /No run yet/ })).toBeTruthy()
    await ui.unmount()
  }
})

import { demoBoard, demoRun, demoTick } from '../hooks/core/demo'

test('the demo plays a whole run', async () => {
  let r = demoRun(100_000)
  expect(sections(r).running.length).toBe(3)
  for (let t = 1; t < 600 && isRunning(r); t++) r = demoTick(r, t, 100_000 + t * 500)
  expect(isRunning(r)).toBe(false)
  expect(r.plan.every(s => s.status === 'completed')).toBe(true)
  expect(r.bees.map(b => b.role)).toContain('code-reviewer')
  expect(demoBoard(0).items.length).toBe(16)
})

const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } } as const

test('/hive demo fills the pane, and demo off clears it', async ($, on) => {
  on('clock.now', () => ({ value: 100_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'hive' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/p' }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, percent: 12 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'hive', args: 'demo', ...TYPED })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Launch kit/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Running · 3/ })).toBeTruthy()
  await ui.press({ key: 'tab-board' })
  expect(await ui.find({ type: 'Text', text: /Sign in with GitHub/ })).toBeTruthy()
  await ui.press({ key: 'tab-stats' })
  expect(await ui.find({ type: 'Text', text: /frontend-dev/ })).toBeTruthy()
  await ui.unmount()
  await $.command.run({ command: 'hive', args: 'demo off', ...TYPED })
  const ui2 = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui2.press({ key: 'tab-hive' })
  expect(await ui2.find({ type: 'Text', text: /No run yet/ })).toBeTruthy()
  await ui2.unmount()
})

test('on the main screen the tabs say their keys', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 30, isFullscreen: false } })
  expect(await ui.find({ type: 'Text', text: /keys 1 2 3/ })).toBeTruthy()
  await ui.unmount()
  const full = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 200, rows: 50, isFullscreen: true } })
  expect(await full.find({ type: 'Text', text: /keys 1 2 3/ })).toBeFalsy()
  await full.unmount()
})

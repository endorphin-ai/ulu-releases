// ULU Hive for Claude Code: the bees El Capitan sends, drawn as in ULU, with
// what each is doing, its steps, tokens, cost and time; El Capitan's plan as a
// chain above the prompt; the run in the status line.
//
// It only watches. It sends nothing anywhere, starts no model call, and
// carries none of ULU's prompts or skills.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Board, BoardItem, Run, View } from '../types'
import { demoBoard, demoRun, demoTick } from './core/demo'
import { COLUMN_NAMES, DOCS_DIRS, FOLDER_TYPES, TYPE_COLORS, TYPE_NAMES, boardColumns, parseItem } from './core/board'
import { ROLE_COLOR, bar, darken, ink } from './core/draw'
import {
  addBee,
  addUsage,
  beeFor,
  beeName,
  contextWindow,
  createdStep,
  endBee,
  endMain,
  fmtCost,
  fmtTime,
  fmtTokens,
  isRunning,
  sawTool,
  sections,
  setLedger,
  shortModel,
  startRun,
  totals,
  wakeBee,
} from './core/hive'

const PANE = 'ulu-hive'
const TITLE = 'ULU Hive'

const run = atom({ plugin: 'ulu-hive', key: 'run' } as const, null, { shape: 'run-1' })
const tick = atom({ plugin: 'ulu-hive', key: 'tick' } as const, 0)
const isFinishedFolded = atom({ plugin: 'ulu-hive', key: 'isFinishedFolded' } as const, false)
const isBandHidden = atom({ plugin: 'ulu-hive', key: 'isBandHidden' } as const, false)
const viewAtom = atom({ plugin: 'ulu-hive', key: 'view' } as const, 'hive')
const boardAtom = atom({ plugin: 'ulu-hive', key: 'board' } as const, null, { shape: 'board-1' })
const isDoneFolded = atom({ plugin: 'ulu-hive', key: 'isDoneFolded' } as const, true)

const BOARD_MAX = 400 // files one read of the board takes

let cwd = ''
let timer: { cancel: () => void } | null = null
let opened = false
let demoTicks = 0
// Whether the terminal draws Claude Code's fullscreen layout: only there a
// pane docks beside the talk and takes clicks. Learnt from any drawing.
let isFullscreen: boolean | undefined
let toldWhere = false

// The pane: docked beside the talk (fullscreen), else a short block above the
// prompt. Opened by the person it takes the keys, so 1, 2, 3 switch tabs.
async function openPane($: EngineInterface, asked: boolean) {
  await $.ui.open({ id: PANE, title: TITLE, columns: 58, rows: 18, ...(asked ? { focus: true as const } : {}) })
}

// Opened unasked only where it sits beside the talk; elsewhere it would cover
// the screen, so a toast says where it is, once.
async function openUnasked($: EngineInterface) {
  if (isFullscreen) return openPane($, false)
  if (!toldWhere) {
    toldWhere = true
    $.ui.toast('🐝 The hive is at work: /hive shows it')
  }
}

// While something works, a tick every half second moves the bees and the
// clock; it stops when the run ends.
async function pulse($: EngineInterface) {
    const r = await read($, run)
    const busy = isRunning(r)
    if (busy && !timer) {
      timer = $.clock.every(500, () => void beat($))
    } else if (!busy && timer) {
      timer.cancel()
      timer = null
    }
    void status($)
}

async function beat($: EngineInterface) {
  const r = await read($, run)
  if (r?.isDemo) {
    const n = ++demoTicks
    const now = await $.clock.now()
    await update($, run, x => (x?.isDemo ? demoTick(x, n, now) : x))
  }
  await update($, tick, n => (n ?? 0) + 1)
  await pulse($)
}

async function startDemo($: EngineInterface) {
  const now = await $.clock.now()
  demoTicks = 0
  await update($, run, () => demoRun(now))
  await update($, boardAtom, () => demoBoard(now))
  await update($, viewAtom, () => 'hive')
  await pulse($)
}

async function endDemo($: EngineInterface) {
  await update($, run, r => (r?.isDemo ? null : r))
  await update($, boardAtom, b => (b?.docs === '(demo)' ? null : b))
  await pulse($)
}

async function status($: EngineInterface) {
    const r = await read($, run)
    if (!r || r.bees.length === 0) return $.ui.status(undefined)
    const { running, finished } = sections(r)
    const { cost, isExact } = totals(r)
    const now = await $.clock.now()
    const time = fmtTime((r.endedAt || now) - r.startedAt)
    const parts = [
      running.length ? `🐝 ${running.length} working` : '🐝 done',
      finished.length ? `${finished.length} finished` : '',
      `${isExact ? '' : '≈'}${fmtCost(cost)}`,
      time,
    ].filter(Boolean)
    $.ui.status(parts.join(' · '))
}

async function showView($: EngineInterface, view: View) {
  await update($, viewAtom, () => view)
  if (view === 'board' && (await read($, boardAtom))?.docs !== '(demo)') await loadBoard($)
}

// Reads the board from the docs folder: each known folder, two levels deep.
async function loadBoard($: EngineInterface) {
  let docs = ''
  for (const d of DOCS_DIRS) {
    if (await $.fs.exists(d).catch(() => false)) {
      const entries = await $.fs.list(d).catch(() => [])
      if (entries.some(x => x.kind === 'dir' && FOLDER_TYPES[x.name.toLowerCase()])) { docs = d; break }
    }
  }
  const items: BoardItem[] = []
  let skipped = 0
  if (docs) {
    const walk = async (dir: string, type: string, depth: number) => {
      for (const x of await $.fs.list(dir).catch(() => [])) {
        const p = `${dir}/${x.name}`
        if (x.kind === 'dir' && depth < 2) await walk(p, type, depth + 1)
        if (x.kind !== 'file' || !/\.md$/i.test(x.name) || /^(template[_-]|readme|index)/i.test(x.name)) continue
        if (items.length >= BOARD_MAX || x.size > 512_000) { skipped++; continue }
        const text = await $.fs.read(p).catch(() => '')
        if (text) items.push(parseItem(text, p, type))
      }
    }
    for (const x of await $.fs.list(docs).catch(() => [])) {
      const type = FOLDER_TYPES[x.name.toLowerCase()]
      if (x.kind === 'dir' && type) await walk(`${docs}/${x.name}`, type, 0)
    }
  }
  items.sort((a, b) => (a.ref || a.title).localeCompare(b.ref || b.title, undefined, { numeric: true }))
  const board: Board = { docs, items, skipped, readAt: await $.clock.now() }
  await update($, boardAtom, () => board)
}

async function change($: EngineInterface, fn: (r: Run) => Run) {
  await update($, run, r => (r ? fn(r) : r))
  await pulse($)
}

export const register: Register = (on, options) => {
  const autoOpen = options.autoOpen !== false

  on('session.start', async ($, e, next) => {
    cwd = await $.session.cwd()
    await $.command.register({
      name: 'hive',
      description: 'Show the bees at work (ULU Hive); "demo" shows made-up data, "demo off" clears it',
      argumentHint: '[demo | demo off]',
    })
    await pulse($)
    return next(e)
  })

  on('command.run', { command: 'hive' }, async ($, e) => {
    const args = e.args.trim().toLowerCase()
    if (args === 'demo off' || args === 'off' || args === 'clear') {
      await endDemo($)
      return { text: 'ULU Hive: the demo is cleared.' }
    }
    if (args === 'demo') {
      await startDemo($)
      await openPane($, true)
      return { text: 'ULU Hive: a made-up run is playing. Switch tabs with 1, 2, 3; /hive demo off clears it.' }
    }
    await openPane($, true)
    return {
      text: e.presentation.isFullscreen
        ? 'ULU Hive is open: click a tab, or press 1, 2, 3.'
        : "ULU Hive is open: press 1, 2, 3 to switch tabs, Esc to go back to the prompt. In Claude Code's fullscreen view it docks beside the talk and takes clicks.",
    }
  })

  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const usd = (await $.session.usage()).cost?.usd
    // /el-capitan starts the team: the hive opens with it.
    if (autoOpen && /^\/el-capitan\b/i.test(e.text.trim())) void openUnasked($)
    // The demo plays on while the person types; a real bee ends it.
    await update($, run, r => (r?.isDemo ? r : setLedger(startRun(r, e.text, cwd, now), usd)))
    await pulse($)
    return next(e)
  }).catch(($, e, next) => next(e)) // never stop what it watches

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.agentId) {
      const now = await $.clock.now()
      const id = started.agentId
      if ((await read($, run))?.isDemo) {
        await endDemo($)
        const usd = (await $.session.usage()).cost?.usd
        await update($, run, () => setLedger(startRun(null, e.description, cwd, now), usd))
      }
      await change($, r => addBee(r, { id, role: e.subagentType, title: e.description, model: started.model }, now))
      if (autoOpen && !opened) {
        opened = true
        void openUnasked($)
      }
    }
    return started
  }).catch(($, e, next) => next(e)) // never stop what it watches

  on('turn.start', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      await change($, r => wakeBee(r, id))
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    for await (const chunk of next(e)) {
      if (chunk.kind === 'stop' && chunk.usage) {
        const usage = chunk.usage
        const effort = typeof e.effort === 'string' ? e.effort : ''
        const ledger = await $.session.usage()
        await update($, run, r =>
          r ? setLedger(addUsage(r, e.agentId, usage, usage.model || e.model, effort), ledger.cost?.usd, ledger.context.window) : r,
        )
      }
      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const tool = String(e.tool)
    await change($, r => sawTool(r, e.agentId, tool, input, cwd))
    const answer = await next(e)
    const file = typeof input.file_path === 'string' ? input.file_path : ''
    if ((tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') && /(^|\/)(dev-)?docs\//.test(file)) {
      if ((await read($, viewAtom)) === 'board') void loadBoard($)
      else await update($, boardAtom, () => null) // read again when the board shows
    }
    if (tool === 'TaskCreate' && !('deny' in answer && answer.deny)) {
      await change($, r => createdStep(r, e.agentId, input, answer, cwd))
    }
    return answer
  }).catch(($, e, next) => next(e)) // never stop what it watches

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    const id = e.agentId
    await change($, r => (id ? endBee(r, id, e.reason, now) : endMain(r, now)))
    return next(e)
  })

  // The pane: the run's totals, then its bees, then what is planned.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = await read($, run)
    const t = await read($, tick)
    const folded = await read($, isFinishedFolded)
    const width = Math.max(30, e.props.bodyColumns ?? 50)
    const now = await $.clock.now()
    const view = await read($, viewAtom)
    if (e.viewport?.isFullscreen !== undefined) isFullscreen = e.viewport.isFullscreen

    // The tabs: a click (or 1, 2, 3 while the pane has the keys) switches.
    const tab = (id: View, label: string, key: string) => (
      <Button
        key={`tab-${id}`}
        label={label}
        hotkey={key}
        variant={view === id ? 'primary' : 'secondary'}
        onPress={() => showView($, id)}
      />
    )
    const frame = (body: RenderChildren) => (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" gap={1} marginBottom={1}>
          {tab('hive', '🐝 Hive', '1')}
          {tab('board', '▦ Board', '2')}
          {tab('stats', '▤ Stats', '3')}
          {e.viewport?.isFullscreen === false && <Text dimColor>keys 1 2 3</Text>}
        </Box>
        {body}
      </Box>
    )

    // Every bee is 🐝; one at work wiggles. Its role is a chip in the role's color.
    const icon = (moving: boolean) => <Text>{moving && t % 2 === 1 ? ' 🐝' : '🐝 '}</Text>
    const chip = (name: string, bee: string, faded = false) => {
      // A finished bee's chip is darker, never dimmed: its words stay sharp.
      const bg = faded ? darken(ROLE_COLOR[bee] ?? ROLE_COLOR.dev!) : (ROLE_COLOR[bee] ?? ROLE_COLOR.dev!)
      return (
        <Text backgroundColor={bg} color={ink(bg)} bold>
          {' '}{name}{' '}
        </Text>
      )
    }
    const textWidth = Math.max(16, width - 3 - 4)

    if (view === 'board') {
      const board = await read($, boardAtom)
      const doneFolded = await read($, isDoneFolded)
      if (!board) return frame(<Text dimColor>Reading the board…</Text>)
      if (!board.docs) {
        return frame(
          <Box flexDirection="column">
            <Text bold>No board yet</Text>
            <Text dimColor>The board shows the work items in dev-docs/ (PRDs, TRDs, stories, test cases, bugs, decisions and risks), as ULU writes them.</Text>
          </Box>,
        )
      }
      const { columns, apart, counts } = boardColumns(board)
      const item = (i: BoardItem) => (
        <Text key={`item-${i.path}`} wrap="truncate">
          <Text color={TYPE_COLORS[i.type] ?? 'gray'}>■ </Text>
          {i.ref && <Text dimColor>{i.ref} </Text>}
          {i.title}
        </Text>
      )
      return frame(
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {counts.map(([type, c]) => (
              <Text key={`count-${type}`}>
                <Text color={TYPE_COLORS[type] ?? 'gray'}>{TYPE_NAMES[type] ?? type}</Text>
                <Text dimColor> {c.done}/{c.total}</Text>
              </Text>
            ))}
          </Box>
          {columns.map(({ column, items }) => (
            <Box key={`col-${column}`} flexDirection="column" marginTop={1}>
              {column === 'done' ? (
                <Button key="fold-done" plain onPress={() => update($, isDoneFolded, f => !f)}>
                  <Text dimColor>{doneFolded ? '▸' : '▾'} Done · {items.length}</Text>
                </Button>
              ) : (
                <Text bold>{COLUMN_NAMES[column]} · {items.length}</Text>
              )}
              {!(column === 'done' && doneFolded) && items.slice(0, 40).map(item)}
              {items.length > 40 && <Text dimColor>and {items.length - 40} more</Text>}
            </Box>
          ))}
          {apart.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Decisions and risks · {apart.length}</Text>
              {apart.slice(0, 30).map(i => (
                <Text key={`apart-${i.path}`} wrap="truncate">
                  <Text color={TYPE_COLORS[i.type] ?? 'gray'}>{i.type === 'risk' ? '▲ ' : '◆ '}</Text>
                  {i.title}
                  <Text dimColor> · {i.status || 'no status'}</Text>
                </Text>
              ))}
            </Box>
          )}
          {board.skipped > 0 && <Text dimColor>{board.skipped} more files are not shown.</Text>}
          <Box marginTop={1}>
            <Button key="refresh" plain onPress={() => loadBoard($)}>
              <Text dimColor>↻ Read again</Text>
            </Button>
          </Box>
        </Box>,
      )
    }

    if (view === 'stats') {
      if (!r || r.bees.length === 0) return frame(<Text dimColor>No bees yet. Stats show once El Capitan sends some.</Text>)
      const usage = await $.session.usage().catch(() => null)
      const byRole = new Map<string, { bee: string; n: number; tokens: number; cost: number; ms: number; failed: number; peak: number }>()
      for (const b of r.bees) {
        const s = byRole.get(b.role) ?? { bee: b.bee, n: 0, tokens: 0, cost: 0, ms: 0, failed: 0, peak: 0 }
        s.n += b.round
        s.peak = Math.max(s.peak, b.ctxTokens)
        s.tokens += b.tokens
        s.cost += b.costUsd
        s.ms += (b.endedAt || now) - b.startedAt
        if (b.status === 'failed') s.failed++
        byRole.set(b.role, s)
      }
      const rows = [...byRole.entries()].sort((a, b) => b[1].cost - a[1].cost)
      const most = Math.max(...rows.map(([, s]) => s.cost), 1e-9)
      const { tokens, cacheRead, cost, isExact } = totals(r)
      return frame(
        <Box flexDirection="column">
          <Text>
            <Text bold>{r.bees.length} bees</Text>
            <Text dimColor> · {fmtTokens(tokens)} new tokens · {isExact ? '' : '≈'}{fmtCost(cost)}</Text>
          </Text>
          <Text dimColor>Context read again from the cache: {fmtTokens(cacheRead)} (cheap; it is what each request sends again)</Text>
          {usage?.context.percent !== undefined && (
            <Text dimColor>El Capitan's context: {Math.round(usage.context.percent ?? 0)}% of {fmtTokens(usage.context.window)}</Text>
          )}
          <Text dimColor>El Capitan itself: {fmtTokens(r.mainTokens)} new tokens · ≈{fmtCost(r.mainCostUsd)}</Text>
          {rows.map(([role, s]) => {
            const line = bar(textWidth, s.cost / most, 0)
            return (
              <Box key={`role-${role}`} flexDirection="row" gap={1} marginTop={1}>
                {icon(false)}
                <Box flexDirection="column" flexGrow={1}>
                  <Text wrap="truncate">{chip(role, s.bee)}</Text>
                  <Text dimColor wrap="truncate">
                    {s.n} {s.n === 1 ? 'round' : 'rounds'}{s.failed ? ` · ${s.failed} failed` : ''} · {fmtTime(s.ms)}
                  </Text>
                  <Text dimColor>{fmtTokens(s.tokens)} new tokens · ≈{fmtCost(s.cost)} · context up to {fmtTokens(s.peak)}</Text>
                  <Text>
                    <Text color={ROLE_COLOR[s.bee] ?? ROLE_COLOR.dev!}>{line.full}</Text>
                    <Text dimColor>{line.empty}</Text>
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>,
      )
    }

    if (!r) {
      return frame(<Text dimColor>No run yet. Start El Capitan, and its bees show here as they work.</Text>)
    }

    const { running, finished, planned } = sections(r)
    const { tokens, cost, isExact } = totals(r)
    const elapsed = fmtTime((r.endedAt || now) - r.startedAt)

    const stat = (label: string, value: string) => (
      <Box borderStyle="round" borderDimColor flexDirection="column" paddingX={1} flexGrow={1}>
        <Text dimColor>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

    const beeRow = (b: Run['bees'][number]) => {
      const isRunning = b.status === 'running'
      const done = b.steps.filter(s => s.status === 'completed').length
      const current = b.steps.find(s => s.status === 'in_progress')
      const total = b.steps.length
      const part = total ? done / total : isRunning ? -1 : 1
      const color = ROLE_COLOR[b.bee] ?? ROLE_COLOR.dev!
      const ctx = b.ctxTokens ? `ctx ${fmtTokens(b.ctxTokens)} (${Math.round((b.ctxTokens / contextWindow(b.model, r.window, b.ctxTokens)) * 100)}%) · ` : ''
      const time = fmtTime((b.endedAt || now) - b.startedAt)
      const progress = total ? `${done}/${total}${current ? ` · ${current.subject}` : ''}` : isRunning ? b.doing : 'done'
      const mark = { running: '●', done: '✓', failed: '✗', stopped: '■' }[b.status]
      const markColor = { running: 'green', done: 'green', failed: 'red', stopped: 'yellow' }[b.status]
      const line = bar(textWidth, part, t)
      return (
        <Box key={`bee-${b.id}`} flexDirection="row" gap={1} marginBottom={1}>
          {icon(isRunning)}
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold wrap="truncate">{b.title}</Text>
              <Text color={markColor}>{mark}</Text>
            </Box>
            <Text wrap="truncate">
              {chip(b.nth > 1 ? `${b.role} #${b.nth}` : b.role, b.bee, !isRunning)}
              {b.round > 1 && <Text color="#ffd34d" bold> round {b.round}</Text>}
              <Text dimColor> {[shortModel(b.model), b.effort].filter(Boolean).join(' · ')}</Text>
            </Text>
            <Box flexDirection="row" justifyContent="space-between">
              <Text wrap="truncate">{progress}</Text>
              <Text dimColor>
                {ctx}
                {fmtTokens(b.tokens)} ≈{fmtCost(b.costUsd)} {time}
              </Text>
            </Box>
            {isRunning && total > 0 && <Text dimColor wrap="truncate">{b.doing}</Text>}
            <Text>
              <Text dimColor>{line.lead}</Text>
              <Text color={color}>{line.full}</Text>
              <Text dimColor>{line.empty}</Text>
            </Text>
          </Box>
        </Box>
      )
    }

    return frame(
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {icon(isRunning(r))}
          <Box flexDirection="column" flexGrow={1}>
            <Text bold wrap="truncate">{r.title}</Text>
            <Text wrap="truncate">
              {chip('El Capitan', 'capitan')}
              <Text dimColor> {isRunning(r) ? r.doing || 'leads the hive' : 'the run has ended'}</Text>
            </Text>
            {r.isDemo && <Text color="#ffd34d">Demo data · /hive demo off clears it</Text>}
          </Box>
        </Box>
        <Box flexDirection="row" gap={1}>
          {stat('Cost', `${isExact ? '' : '≈'}${fmtCost(cost)}`)}
          {stat('Tokens', fmtTokens(tokens))}
          {stat('Time', elapsed)}
        </Box>

        {r.bees.length === 0 && planned.length === 0 && (
          <Text dimColor>No bees yet. They show here when El Capitan sends them.</Text>
        )}

        {running.length > 0 && <Text dimColor>Running · {running.length}</Text>}
        {running.map(beeRow)}

        {finished.length > 0 && (
          <Button key="fold" plain onPress={() => update($, isFinishedFolded, f => !f)}>
            <Text dimColor>
              {folded ? '▸' : '▾'} Finished · {finished.length}
            </Text>
          </Button>
        )}
        {!folded && finished.map(beeRow)}

        {planned.length > 0 && <Text dimColor>Planned · {planned.length}</Text>}
        {planned.map(s => (
          <Box key={`plan-${s.id}`} flexDirection="row" gap={1} marginBottom={1}>
            {icon(false)}
            <Box flexDirection="column" flexGrow={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text dimColor wrap="truncate">
                  {s.n}. {s.subject}
                </Text>
                <Text dimColor>◷</Text>
              </Box>
              <Text wrap="truncate">
                {chip(beeName(beeFor(s.subject)), beeFor(s.subject), true)}
                {s.after.length > 0 && <Text dimColor> after {s.after.join(', ')}</Text>}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>,
    )
  })

  // The chain above the prompt: El Capitan's plan, the step at work lit.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.viewport?.isFullscreen !== undefined) isFullscreen = e.viewport.isFullscreen
    const r = await read($, run)
    if (e.props.hasSurvey || !r || r.plan.length === 0 || !isRunning(r) || (await read($, isBandHidden))) {
      return next(e)
    }
    const t = await read($, tick)
    const { Box, Text, Button } = $.ui.resolve(e)
    const spin = '◐◓◑◒'[t % 4]!
    const width = e.props.bodyColumns ?? 80
    const each = Math.max(6, Math.floor((width - 14) / r.plan.length) - 3)
    const cut = (s: string) => (s.length > each ? s.slice(0, each - 1) + '…' : s)
    return (
      <Box flexDirection="row" gap={1}>
        <Text color="#ffd34d">🐝</Text>
        {r.plan.map((s, i) => (
          <Text key={`step-${s.id}`}>
            {i > 0 && <Text dimColor>─ </Text>}
            {s.status === 'completed' && <Text color="green">● </Text>}
            {s.status === 'in_progress' && <Text color="#ffd34d">{spin} </Text>}
            {s.status === 'pending' && <Text dimColor>○ </Text>}
            <Text dimColor={s.status !== 'in_progress'} bold={s.status === 'in_progress'}>
              {cut(s.subject)}
            </Text>
          </Text>
        ))}
        <Button key="hide" plain label="×" onPress={() => update($, isBandHidden, () => true)} />
      </Box>
    )
  })
}

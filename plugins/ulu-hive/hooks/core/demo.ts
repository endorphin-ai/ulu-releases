// /hive demo: a made-up run and board, so the hive can be seen at work
// without a real team. The bees move on by themselves: a step every few
// seconds, tokens and cost going up, a new bee when one finishes.

import type { Bee, Board, BoardItem, Run, Step } from '../../types'
import { beeFor, costOf } from './hive'

const steps = (done: number, names: string[]): Step[] =>
  names.map((subject, i) => ({
    id: `s${i}`,
    subject,
    status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending',
    blockedBy: [],
  }))

function bee(
  id: string, role: string, title: string, model: string, effort: string,
  startedAgo: number, now: number, s: Step[], tokens: number, status: Bee['status'] = 'running',
): Bee {
  const u = { input_tokens: tokens * 0.08, output_tokens: tokens * 0.12, cache_read_input_tokens: tokens * 0.8 }
  return {
    id, role, title, bee: beeFor(`${role} ${title}`), model, effort, status,
    startedAt: now - startedAgo, endedAt: status === 'running' ? 0 : now - startedAgo / 3,
    tokens, costUsd: costOf(model, u), ctxTokens: tokens * 0.6,
    doing: status === 'running' ? 'Starting' : '', steps: s,
  }
}

export function demoRun(now: number): Run {
  const plan: Step[] = [
    { id: '1', subject: 'Write the PRD', status: 'completed', blockedBy: [] },
    { id: '2', subject: 'Design the launch', status: 'completed', blockedBy: [] },
    { id: '3', subject: 'Build the landing page and sign-up', status: 'in_progress', blockedBy: ['1', '2'] },
    { id: '4', subject: 'Test the sign-up flow', status: 'pending', blockedBy: ['3'] },
    { id: '5', subject: 'Review the whole kit', status: 'pending', blockedBy: ['3', '4'] },
  ]
  return {
    title: 'Launch kit',
    startedAt: now - 94_000,
    endedAt: 0,
    isMainBusy: true,
    mainTokens: 61_000,
    mainCostUsd: 0.09,
    doing: 'Sending a bee: Build the landing page',
    plan,
    costBase: -1,
    exactCost: -1,
    isDemo: true,
    bees: [
      bee('d1', 'frontend-dev', 'Build the landing page', 'claude-opus-5-5', 'low', 41_000, now,
        steps(2, ['Hero', 'Hero copy', 'Pricing', 'Sign-up form', 'Footer']), 38_000),
      bee('d2', 'go-dev', 'Write the sign-up API', 'claude-sonnet-5-5', 'medium', 33_000, now,
        steps(1, ['Routes', 'Validation', 'E-mail check', 'Tests']), 27_000),
      bee('d3', 'devops-engineer', 'Set up the preview deploy', 'claude-haiku-5-5', 'low', 12_000, now, [], 9_000),
      bee('d4', 'designer', 'Design the launch graphics', 'claude-opus-5-5', 'medium', 66_000, now,
        steps(4, ['Moodboard', 'Logo lockup', 'Hero art', 'Social cards']), 39_000, 'done'),
      bee('d5', 'pm', 'Research competitor launches', 'claude-opus-5-5', 'high', 80_000, now,
        steps(4, ['Find 10 launches', 'Compare pricing', 'Find the gaps', 'Write it up']), 44_000, 'done'),
      bee('d6', 'security-reviewer', 'Check the auth setup', 'claude-sonnet-5-5', 'high', 52_000, now,
        steps(1, ['Read the auth code', 'Check the secrets']), 15_000, 'failed'),
    ],
  }
}

const DOING: Record<string, string[]> = {
  frontend: ['Editing src/pages/index.tsx', 'Editing src/components/Hero.tsx', 'Running npm run build', 'Reading src/styles/theme.css'],
  dev: ['Editing api/signup.go', 'Running go test ./api/...', 'Reading api/routes.go', 'Searching ValidateEmail'],
  devops: ['Editing render.yaml', 'Running npx wrangler deploy --dry-run', 'Reading .github/workflows/ci.yml', 'Using render'],
  qe: ['Writing e2e/signup.spec.ts', 'Running npx playwright test', 'Reading dev-docs/test_cases/tc-012.md'],
  lead: ['Reading the diff', 'Reading api/signup.go', 'Writing dev-docs/sessions/review.md'],
}

// One tick (half a second) of the demo.
export function demoTick(run: Run, tick: number, now: number): Run {
  let bees = run.bees.map(b => {
    if (b.status !== 'running') return b
    const lines = DOING[b.bee] ?? DOING.dev!
    const grown = { ...b, tokens: b.tokens + 140, costUsd: b.costUsd + costOf(b.model, { output_tokens: 20, cache_read_input_tokens: 120 }), ctxTokens: b.ctxTokens + 90 }
    if (tick % 4 === 0) grown.doing = lines[(tick / 4 + b.id.length) % lines.length]!
    if (tick % 9 === 0 && b.steps.length) {
      const at = b.steps.findIndex(s => s.status === 'in_progress')
      if (at >= 0) {
        grown.steps = b.steps.map((s, i) =>
          i === at ? { ...s, status: 'completed' } : i === at + 1 ? { ...s, status: 'in_progress' } : s,
        )
        if (at === b.steps.length - 1) return { ...grown, status: 'done' as const, endedAt: now, doing: '' }
      }
    }
    if (!b.steps.length && tick % 40 === 0) return { ...grown, status: 'done' as const, endedAt: now, doing: '' }
    return grown
  })
  let plan = run.plan
  const open = bees.filter(b => b.status === 'running').length
  // The build is done: the tester starts, then the reviewer.
  const next = plan.find(s => s.status === 'pending' && s.blockedBy.every(id => plan.find(p => p.id === id)?.status === 'completed'))
  if (open === 0 && plan.find(s => s.status === 'in_progress')) {
    plan = plan.map(s => (s.status === 'in_progress' ? { ...s, status: 'completed' } : s))
  } else if (open <= 1 && next) {
    plan = plan.map(s => (s.id === next.id ? { ...s, status: 'in_progress' } : s))
    const role = next.id === '4' ? 'qa-tester' : 'code-reviewer'
    const names = next.id === '4' ? ['Write the cases', 'Run them', 'Report'] : ['Read the PRD', 'Read the diff', 'Write the review']
    bees = [...bees, bee(`d${bees.length + 1}`, role, next.subject, 'claude-opus-5-5', 'xhigh', 0, now, steps(0, names), 2_000)]
  }
  const ended = !bees.some(b => b.status === 'running') && plan.every(s => s.status === 'completed')
  return {
    ...run,
    bees,
    plan,
    mainTokens: run.mainTokens + 40,
    mainCostUsd: run.mainCostUsd + 0.0002,
    isMainBusy: !ended,
    endedAt: ended ? now : 0,
    doing: ended ? '' : run.doing,
  }
}

const item = (path: string, type: string, ref: string, title: string, status: string, column: BoardItem['column']): BoardItem =>
  ({ path: `dev-docs/${path}`, type, ref, title, status, column })

export function demoBoard(now: number): Board {
  return {
    docs: '(demo)',
    skipped: 0,
    readAt: now,
    items: [
      item('prd/launch-kit.md', 'prd', 'PRD-001', 'Launch kit', 'approved', 'done'),
      item('prd/referrals.md', 'prd', 'PRD-002', 'Referral programme', 'draft', 'todo'),
      item('trd/signup.md', 'trd', 'TRD-001', 'Sign-up and e-mail check', 'in review', 'in_review'),
      item('epics/launch.md', 'epic', 'EP-01', 'Launch', 'in progress', 'in_progress'),
      item('user_stories/us-001.md', 'user_story', 'US-001', 'See the landing page', 'done', 'done'),
      item('user_stories/us-002.md', 'user_story', 'US-002', 'Sign up with an e-mail', 'in progress', 'in_progress'),
      item('user_stories/us-003.md', 'user_story', 'US-003', 'Sign in with GitHub', 'in progress', 'in_progress'),
      item('user_stories/us-004.md', 'user_story', 'US-004', 'See the pricing', 'ready for QA', 'in_qa'),
      item('user_stories/us-005.md', 'user_story', 'US-005', 'Invite a friend', 'todo', 'todo'),
      item('user_stories/us-006.md', 'user_story', 'US-006', 'Change the plan', 'todo', 'todo'),
      item('test_cases/tc-011.md', 'test_case', 'TC-011', 'Sign-up with a bad e-mail', 'passed', 'done'),
      item('test_cases/tc-012.md', 'test_case', 'TC-012', 'Sign-up twice with one e-mail', 'todo', 'todo'),
      item('bugs/bug-007.md', 'bug', 'BUG-007', 'Hero image jumps on load', 'in progress', 'in_progress'),
      item('decisions/d-001.md', 'decision', 'D-001', 'Use Postgres on Render', 'accepted', 'done'),
      item('decisions/d-002.md', 'decision', 'D-002', 'E-mail check by link, not code', 'accepted', 'done'),
      item('risks/r-001.md', 'risk', 'R-001', 'The launch date is before the API is load tested', 'open', 'todo'),
    ],
  }
}
